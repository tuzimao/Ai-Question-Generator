// test/integration/OpenAIEmbedding.test.ts
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

import { UserModel } from '../../src/models/User';
import DocumentModel, { DocumentIngestStatus } from '../../src/models/Document';
import DocumentChunkModel, { EmbeddingStatus } from '../../src/models/DocumentChunk';

import { DocumentTestHelper } from '../helpers/documentHelper';
import { ChunkService } from '../../src/services/ChunkService';
import EmbeddingService from '../../src/services/EmbeddingService'; // 默认导出也可：export default EmbeddingService

import { EmbeddingProviderType, VectorStoreType, EmbeddingConfig } from '../../src/types/embedding';

const hasOpenAI = !!process.env.OPENAI_API_KEY;

describe('OpenAI Embedding 集成测试（有 OPENAI_API_KEY 才运行）', () => {
  let TEST_USER_ID!: string;
  let docId!: string;

  beforeAll(async () => {
    if (!hasOpenAI) {
      console.warn('⚠️ 未检测到 OPENAI_API_KEY，整个套件将被 skip。');
      return;
    }
    // 建一个测试用户
    const now = Date.now();
    const user = await UserModel.create({
      email: `openai-test+${now}@example.com`,
      username: `openai_user_${now}`,
      password: 'P@ssw0rd!123',
      display_name: 'OpenAI Test User',
    });
    TEST_USER_ID = user.id;
  });

  afterAll(async () => {
    // 不强制删除，便于你检视 DB；如果需要可软删：
    // if (docId) await DocumentModel.softDelete(docId);
    // 清理 EmbeddingService 内部 provider/store 缓存
    EmbeddingService.cleanup();
  });

  (hasOpenAI ? it : it.skip)(
    '应完成：解析→分块→向量化（OpenAI + Memory）',
    async () => {
      // 1) 准备一份文本并创建文档 + 解析（走你现有 helper）
      const content = [
        '# 向量化端到端测试',
        '',
        '第一段：这是一个用于测试 OpenAI 嵌入的文本段落，包含中文与 English 混排。',
        '',
        '## 第二章 分块',
        '这里我们会生成多个 chunk，以便测试批量嵌入。',
        '',
        '第三段：再来一点文字，确保有 2~4 个块即可，避免触发速率限制。'
      ].join('\n');

      const document = await DocumentTestHelper.createTestDocument(
        TEST_USER_ID,
        'openai-embed.txt',
        content,
        'text/plain'
      );
      expect(document.doc_id).toBeTruthy();

      // 解析（TextParser）
      const job = await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);
      expect(job).toBeDefined();
      docId = document.doc_id;

      const parsed = await DocumentModel.findById(docId);
      expect(parsed?.ingest_status).toBe(DocumentIngestStatus.PARSED);

      // 2) 分块（控制为小批次，便于 OpenAI 速率）
      const chunkResult = await ChunkService.chunkDocument({
        docId,
        userId: TEST_USER_ID,
        config: {
          strategy: 'fixed_size' as any,
          targetTokens: 120,
          maxTokens: 160,
          overlapTokens: 20,
          respectBoundaries: true,
          minChunkSize: 50
        }
      });

      expect(chunkResult.chunksCreated).toBeGreaterThan(0);
      expect((await DocumentModel.findById(docId))?.ingest_status)
        .toBe(DocumentIngestStatus.CHUNKED);

      const chunksBefore = await DocumentChunkModel.findByDocument(docId);
      expect(chunksBefore.length).toBeGreaterThan(0);

      // 3) 向量化（OpenAI Provider + Memory Store）
      // 注意：OpenAI text-embedding-3-small 维度为 1536
      const embeddingConfig: EmbeddingConfig = {
        provider: EmbeddingProviderType.OPENAI,
        model: 'text-embedding-3-small',
        dimension: 1536,
        batchSize: Math.min(8, chunksBefore.length), // 小批次，避免 429
        maxConcurrent: 1,
        retryOnFailure: true,
        requestInterval: 250, // 每次调用间隔，进一步避免速率限制
      };

      const result = await EmbeddingService.embedDocument({
        docId,
        userId: TEST_USER_ID,
        config: embeddingConfig,
        vectorStore: VectorStoreType.QDRANT, // 或 VectorStoreType.MEMORY
        onProgress: async (p) => {
          // 可视化进度，便于排障
          // console.log(`进度 ${p.current}/${p.total} - ${p.message}`);
        }
      });

      expect(result.chunksProcessed).toBeGreaterThan(0);
      expect(result.chunksFailed).toBe(0);
      expect(result.model).toBe('text-embedding-3-small');
      expect(result.provider).toBe(EmbeddingProviderType.OPENAI);
      expect(result.vectorStoreType).toBe(VectorStoreType.QDRANT);

      // 4) 校验数据库状态
      const docAfter = await DocumentModel.findById(docId);
      expect(docAfter?.ingest_status).toBe(DocumentIngestStatus.READY);

      const chunksAfter = await DocumentChunkModel.findByDocument(docId);
      const finished = chunksAfter.filter(c => c.embedding_status === EmbeddingStatus.COMPLETED);
      expect(finished.length).toBe(chunksAfter.length);

      // 5) spot check：至少头一个 chunk 写了 model 名 & vector_id
      const first = finished[0];
      expect(first.embedding_model).toBe('text-embedding-3-small');
      expect(first.vector_id).toBeTruthy(); // Memory store 下通常是 `memory:<chunkId>`
    }
  );
});