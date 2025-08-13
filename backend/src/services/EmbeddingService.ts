// src/services/EmbeddingService.ts - 向量化核心服务

import { Knex } from 'knex';
import { Database } from '@/utils/database';
import DocumentModel, { Document, DocumentIngestStatus } from '@/models/Document';
import DocumentChunkModel, {
  DocumentChunk,
  EmbeddingStatus
} from '@/models/DocumentChunk';
import { TextNormalizer } from '@/services/TextNormalizer';
import { 
  EmbeddingRequest,
  EmbeddingResult,
  EmbeddingProgress,
  BatchEmbeddingInput,
  VectorPoint,
  EmbeddingProviderType,
  VectorStoreType
} from '@/types/embedding';
import { IEmbeddingProvider } from '@/providers/embedding/EmbeddingProvider';
import { OpenAIEmbeddingProvider } from '@/providers/embedding/OpenAIEmbeddingProvider';
import { LocalEmbeddingProvider } from '@/providers/embedding/LocalEmbeddingProvider';
import { IVectorStore } from '@/stores/vector/VectorStore';
import { MemoryVectorStore } from '@/stores/vector/MemoryVectorStore';
import { QdrantVectorStore } from '@/stores/vector/QdrantVectorStore';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 向量化服务
 * 
 * 职责：
 * - 协调向量生成和存储流程
 * - 管理不同的Embedding Provider
 * - 管理不同的Vector Store
 * - 批量处理和优化
 * - 错误处理和重试
 * - 成本控制
 */
export class EmbeddingService {
  private static readonly VERSION = '1.0.0';
  private static providers: Map<EmbeddingProviderType, IEmbeddingProvider> = new Map();
  private static vectorStores: Map<VectorStoreType, IVectorStore> = new Map();

  /**
   * 处理文档向量化
   */
  public static async embedDocument(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const { docId, userId, config, vectorStore, onProgress } = request;
    const startTime = Date.now();

    console.log(`🚀 开始文档向量化: ${docId} (Provider: ${config.provider}, Store: ${vectorStore})`);

    try {
      // 1. 幂等性检查
      await this.updateProgress(onProgress, 5, 100, '检查向量化状态...');
      const shouldSkip = await this.checkIdempotency(docId);
      if (shouldSkip) {
        console.log(`♻️ 文档已向量化，跳过处理: ${docId}`);
        return await this.getExistingEmbeddingResult(docId);
      }

      // 2. 验证文档状态
      await this.updateProgress(onProgress, 10, 100, '验证文档状态...');
      const document = await this.validateDocument(docId, userId);

      // 3. 获取待处理的chunks
      await this.updateProgress(onProgress, 15, 100, '获取待处理块...');
      const pendingChunks = await DocumentChunkModel.findPendingEmbedding(1000, {
        docId
      });

      if (pendingChunks.length === 0) {
        throw new Error('没有待处理的块');
      }

      console.log(`📦 找到 ${pendingChunks.length} 个待向量化的块`);

      // 4. 初始化Provider和VectorStore
      await this.updateProgress(onProgress, 20, 100, '初始化向量服务...');
      const provider = await this.getOrCreateProvider(config);
      const store = await this.getOrCreateVectorStore(vectorStore, config.dimension);

      // 5. 更新文档状态
      await DocumentModel.updateStatus(docId, DocumentIngestStatus.EMBEDDING);

      // 6. 批量处理chunks
      let processedChunks = 0;
      let failedChunks = 0;
      let totalTokens = 0;
      let totalCost = 0;

      const batchSize = config.batchSize;
      for (let i = 0; i < pendingChunks.length; i += batchSize) {
        const batch = pendingChunks.slice(i, i + batchSize);
        
        // 更新进度
        const progress = 25 + (i / pendingChunks.length) * 60;
        await this.updateProgress(
          onProgress,
          progress,
          100,
          `处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(pendingChunks.length / batchSize)}...`,
          {
            processedChunks,
            totalChunks: pendingChunks.length,
            failedChunks,
            tokensProcessed: totalTokens,
            estimatedCost: totalCost
          }
        );

        try {
          // 标记chunks为处理中
          await this.markChunksProcessing(batch.map(c => c.chunk_id));

          // 准备批量输入
          const batchInputs: BatchEmbeddingInput[] = batch.map(chunk => ({
            id: chunk.chunk_id,
            text: chunk.content_cleaned || chunk.content,
            metadata: {
              doc_id: chunk.doc_id,
              section_id: chunk.section_id,
              chunk_index: chunk.chunk_index
            }
          }));

          // 生成向量
          const embeddings = await provider.generateBatchEmbeddings(batchInputs);

          // 准备向量点
          const vectorPoints: VectorPoint[] = [];
          for (const embedding of embeddings) {
            const chunk = batch.find(c => c.chunk_id === embedding.id);
            if (!chunk) continue;

            vectorPoints.push({
              id: chunk.chunk_id,
              vector: embedding.vector,
              payload: {
                doc_id: chunk.doc_id,
                chunk_id: chunk.chunk_id,
                user_id: userId,
                content: chunk.content,
                chunk_index: chunk.chunk_index,
                section_id: chunk.section_id,
                page_numbers: chunk.primary_page ? [chunk.primary_page] : undefined,
                token_count: chunk.token_count,
                created_at: new Date().toISOString(),
                metadata: {
                  doc_title: document.filename,
                  doc_type: document.mime_type,
                  language: document.language,
                  chunk_type: chunk.chunk_type,
                  content_quality: chunk.content_quality
                }
              }
            });

            // 统计
            totalTokens += chunk.token_count;
          }

          // 存储向量
          if (vectorPoints.length > 0) {
            await store.upsert(vectorPoints);
          }

          // 更新chunks状态
          await this.updateChunksEmbedded(
            vectorPoints.map(vp => vp.id),
            config.model,
            vectorStore
          );

          processedChunks += vectorPoints.length;
          
          // 估算成本
          const batchCost = provider.estimateCost(
            batch.reduce((sum, c) => sum + c.token_count, 0)
          );
          totalCost += batchCost;

        } catch (error) {
          console.error(`批次处理失败:`, error);
          
          // 标记批次中的chunks为失败
          await this.markChunksFailed(
            batch.map(c => c.chunk_id),
            getErrorMessage(error)
          );
          
          failedChunks += batch.length;
          
          // 如果失败太多，停止处理
          if (failedChunks > pendingChunks.length * 0.1) {
            throw new Error(`失败率过高: ${failedChunks}/${pendingChunks.length}`);
          }
        }
      }

      // 7. 更新文档状态
      await this.updateProgress(onProgress, 90, 100, '更新文档状态...');
      if (failedChunks === 0) {
        await DocumentModel.updateStatus(docId, DocumentIngestStatus.READY);
      } else {
        await DocumentModel.update(docId, {
          ingest_status: DocumentIngestStatus.READY,
          metadata: {
            embeddingWarning: `${failedChunks} chunks failed`
          }
        });
      }

      // 8. 生成结果
      const duration = Date.now() - startTime;
      const result: EmbeddingResult = {
        docId,
        chunksProcessed: processedChunks,
        chunksFailed: failedChunks,
        totalTokens,
        totalCost,
        provider: config.provider,
        model: config.model,
        duration,
        vectorStoreType: vectorStore
      };

      await this.updateProgress(onProgress, 100, 100, '向量化完成');
      console.log(`✅ 文档向量化完成: ${docId} (${processedChunks}个块, 耗时: ${duration}ms, 成本: $${totalCost.toFixed(4)})`);

      return result;

    } catch (error) {
      console.error(`❌ 文档向量化失败: ${docId}`, error);
      
      // 更新文档状态为失败
      await DocumentModel.updateStatus(
        docId,
        DocumentIngestStatus.FAILED,
        undefined,
        `向量化失败: ${getErrorMessage(error)}`
      );
      
      throw error;
    }
  }

  /**
   * 检查幂等性
   */
  private static async checkIdempotency(docId: string): Promise<boolean> {
    const stats = await DocumentChunkModel.getDocumentChunkStats(docId);
    return stats.byStatus[EmbeddingStatus.COMPLETED] > 0;
  }

  /**
   * 验证文档
   */
  private static async validateDocument(docId: string, userId: string): Promise<Document> {
    const document = await DocumentModel.findById(docId);
    
    if (!document) {
      throw new Error(`文档不存在: ${docId}`);
    }

    // 开发环境跳过用户验证
    if (process.env.NODE_ENV !== 'development' && document.user_id !== userId) {
      throw new Error('无权限处理该文档');
    }

    // 检查文档状态
    const validStatuses = [
      DocumentIngestStatus.CHUNKED,
      DocumentIngestStatus.EMBEDDING,
      DocumentIngestStatus.READY // 允许重新向量化
    ];

    if (!validStatuses.includes(document.ingest_status)) {
      throw new Error(`文档状态不正确: ${document.ingest_status}`);
    }

    return document;
  }

  /**
   * 获取或创建Provider
   */
  private static async getOrCreateProvider(config: any): Promise<IEmbeddingProvider> {
    let provider = this.providers.get(config.provider);
    
    if (!provider) {
      switch (config.provider) {
        case EmbeddingProviderType.OPENAI:
          provider = new OpenAIEmbeddingProvider(config.dimension);
          break;
        case EmbeddingProviderType.LOCAL:
          provider = new LocalEmbeddingProvider(config.dimension);
          break;
        default:
          throw new Error(`不支持的Provider: ${config.provider}`);
      }
      
      await provider.initialize(config);
      this.providers.set(config.provider, provider);
    }
    
    return provider;
  }

  /**
   * 获取或创建VectorStore
   */
  private static async getOrCreateVectorStore(
    storeType: VectorStoreType,
    dimension: number
  ): Promise<IVectorStore> {
    let store = this.vectorStores.get(storeType);
    
    if (!store) {
      switch (storeType) {
        case VectorStoreType.MEMORY:
          store = new MemoryVectorStore();
          break;
        case VectorStoreType.QDRANT:
          store = new QdrantVectorStore();
          break;
        default:
          throw new Error(`不支持的VectorStore: ${storeType}`);
      }
      
      const collectionName = process.env.QDRANT_COLLECTION_NAME || 'documents';
      await store.initialize(collectionName, dimension);
      this.vectorStores.set(storeType, store);
    }
    
    return store;
  }

  /**
   * 标记chunks为处理中
   */
  private static async markChunksProcessing(chunkIds: string[]): Promise<void> {
    await Database.withTransaction(async (trx: Knex.Transaction) => {
      for (const chunkId of chunkIds) {
        await DocumentChunkModel.updateEmbeddingStatus(
          chunkId,
          EmbeddingStatus.PROCESSING,
          undefined,
          undefined,
          trx
        );
      }
    });
  }

  /**
   * 更新chunks为已嵌入
   */
  private static async updateChunksEmbedded(
    chunkIds: string[],
    model: string,
    vectorStore: VectorStoreType
  ): Promise<void> {
    await Database.withTransaction(async (trx: Knex.Transaction) => {
      for (const chunkId of chunkIds) {
        await DocumentChunkModel.updateEmbeddingStatus(
          chunkId,
          EmbeddingStatus.COMPLETED,
          `${vectorStore}:${chunkId}`,
          model,
          trx
        );
      }
    });
  }

  /**
   * 标记chunks为失败
   */
  private static async markChunksFailed(
    chunkIds: string[],
    errorMessage: string
  ): Promise<void> {
    await Database.withTransaction(async (trx: Knex.Transaction) => {
      for (const chunkId of chunkIds) {
        await DocumentChunkModel.update(
          chunkId,
          {
            embedding_status: EmbeddingStatus.FAILED,
            processing_notes: errorMessage
          },
          trx
        );
      }
    });
  }

  /**
   * 获取现有结果
   */
  private static async getExistingEmbeddingResult(docId: string): Promise<EmbeddingResult> {
    const stats = await DocumentChunkModel.getDocumentChunkStats(docId);
    
    return {
      docId,
      chunksProcessed: stats.byStatus[EmbeddingStatus.COMPLETED],
      chunksFailed: stats.byStatus[EmbeddingStatus.FAILED],
      totalTokens: stats.totalTokens,
      totalCost: 0,
      provider: 'unknown',
      model: 'unknown',
      duration: 0,
      vectorStoreType: 'unknown'
    };
  }

  /**
   * 更新进度
   */
  private static async updateProgress(
    onProgress: ((progress: EmbeddingProgress) => Promise<void>) | undefined,
    current: number,
    total: number,
    message: string,
    details?: any
  ): Promise<void> {
    if (onProgress) {
      try {
        await onProgress({
          current,
          total,
          message,
          details
        });
      } catch (error) {
        console.warn('进度更新失败:', error);
      }
    }
  }

  /**
   * 清理资源
   */
  public static cleanup(): void {
    // 清理所有Provider
    for (const provider of this.providers.values()) {
      provider.cleanup();
    }
    this.providers.clear();

    // 清理所有VectorStore
    for (const store of this.vectorStores.values()) {
      store.cleanup();
    }
    this.vectorStores.clear();
  }
}

export default EmbeddingService;