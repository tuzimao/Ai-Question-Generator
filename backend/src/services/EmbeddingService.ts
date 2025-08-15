// src/services/EmbeddingService.ts - 向量化核心服务

import { Knex } from 'knex';
import { Database } from '@/utils/database';
import DocumentModel, { Document, DocumentIngestStatus } from '@/models/Document';
import DocumentChunkModel, {
  DocumentChunk,
  EmbeddingStatus
} from '@/models/DocumentChunk';
//import { TextNormalizer } from '@/services/TextNormalizer';
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
  private static providers: Map<string, IEmbeddingProvider> = new Map();
  private static vectorStores: Map<string, IVectorStore> = new Map();

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
        const batch = pendingChunks
            .slice(i, i + batchSize)
            // 过滤空文本
            .filter(c => (c.content_cleaned || c.content || '').trim().length > 0);
        
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
        // 标记 processing（仅针对此 batch 的 ids）
        const batchIds = batch.map(c => c.chunk_id);
        await this.markChunksProcessing(batchIds);

        // 准备输入
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

        // 将结果按 id 建索引
        const byId = new Map(embeddings.map(e => [e.id, e]));

        // 拆分成功/缺失
        const succeeded: VectorPoint[] = [];
        const missing: string[] = [];

        for (const chunk of batch) {
            const e = byId.get(chunk.chunk_id);
            if (!e?.vector?.length) {
            missing.push(chunk.chunk_id);
            continue;
            }
            // tokens 兜底
            const tok = typeof chunk.token_count === 'number' && chunk.token_count > 0
            ? chunk.token_count
            : Math.max(1, (chunk.content_cleaned || chunk.content).length / 4 | 0);

            succeeded.push({
            id: chunk.chunk_id,
            vector: e.vector,
            payload: {
                doc_id: chunk.doc_id,
                chunk_id: chunk.chunk_id,
                user_id: userId,
                content: chunk.content, // 或者 content_cleaned，看你的需求
                chunk_index: chunk.chunk_index,
                ...(chunk.section_id ? { section_id: chunk.section_id } : {}),
                ...(chunk.primary_page ? { page_numbers: [chunk.primary_page] } : {}),
                token_count: tok,
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

            totalTokens += tok;
        }

        // 存储向量（仅成功项）
        if (succeeded.length > 0) {
            await store.upsert(succeeded);
        }

        // 更新 DB 状态
        if (succeeded.length > 0) {
            await this.updateChunksEmbedded(
            succeeded.map(v => v.id),
            config.model,
            vectorStore
            );
        }
        if (missing.length > 0) {
            await this.markChunksFailed(missing, 'provider 未返回 embedding');
            failedChunks += missing.length;
        }

        processedChunks += succeeded.length;

        // 成本估算
        const batchTokenSum = batch.reduce((sum, c) => {
            const tok = typeof c.token_count === 'number' && c.token_count > 0
            ? c.token_count
            : Math.max(1, (c.content_cleaned || c.content).length / 4 | 0);
            return sum + tok;
        }, 0);
        totalCost += provider.estimateCost(batchTokenSum);

        } catch (error) {
        console.error(`批次处理失败:`, error);
        await this.markChunksFailed(batch.map(c => c.chunk_id), getErrorMessage(error));
        failedChunks += batch.length;
        if (failedChunks > pendingChunks.length * 0.1) {
            throw new Error(`失败率过高: ${failedChunks}/${pendingChunks.length}`);
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

    } 
}catch (error) {
      console.error(`❌ 文档向量化失败: ${docId}`, error);
      
      // 更新文档状态为失败
      await DocumentModel.updateStatus(
        docId,
        DocumentIngestStatus.FAILED,
        `向量化失败: ${getErrorMessage(error)}`
      );
      
      throw error;
    }
  }


// 替换原来的 checkIdempotency
  private static async checkIdempotency(docId: string): Promise<boolean> {
    const stats = await DocumentChunkModel.getDocumentChunkStats(docId);
    const pending = (stats.byStatus?.[EmbeddingStatus.PENDING] ?? 0)
                    + (stats.byStatus?.[EmbeddingStatus.PROCESSING] ?? 0)
                    + (stats.byStatus?.[EmbeddingStatus.FAILED] ?? 0); // 允许重试失败
    // 仅当没有 pending/processing/failed 时才认为“已经完成可以跳过”
    return pending === 0 && (stats.byStatus?.[EmbeddingStatus.COMPLETED] ?? 0) > 0;
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
  const key = `${config.provider}:${config.model}:${config.dimension}`;
  let provider = this.providers.get(key);

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
    this.providers.set(key, provider);
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
  const collectionName = process.env.QDRANT_COLLECTION || 'documents';
  const key = `${storeType}:${collectionName}:${dimension}`;

  let store = this.vectorStores.get(key);
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
    await store.initialize(collectionName, dimension);
    this.vectorStores.set(key, store);
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

  // 新增：批量更新工具（若你的 Model 已有类似方法可直接用）
    private static async bulkUpdateEmbeddingStatus(
    chunkIds: string[],
    status: EmbeddingStatus,
    extra: Partial<{
        vector_id: string | null;
        embedding_model: string | null;
        processing_notes: string | null;
    }> = {}
    ): Promise<void> {
    if (chunkIds.length === 0) return;
    await Database.getInstance()('document_chunks')
        .whereIn('chunk_id', chunkIds)
        .update({
        embedding_status: status,
        vector_id: extra.vector_id ?? null,
        embedding_model: extra.embedding_model ?? null,
        processing_notes: extra.processing_notes ?? null,
        updated_at: new Date(),
        });
    }

  /**
   * 更新chunks为已嵌入
   */
    private static async updateChunksEmbedded(
        chunkIds: string[],
        model: string,
        _vectorStore: VectorStoreType
        ): Promise<void> {
        await Database.withTransaction(async (trx: Knex.Transaction) => {
            for (const chunkId of chunkIds) {
            // 关键修改：vector_id 只存 chunkId，避免超长
            const vectorId = chunkId;

            await DocumentChunkModel.updateEmbeddingStatus(
                chunkId,
                EmbeddingStatus.COMPLETED,
                vectorId,
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