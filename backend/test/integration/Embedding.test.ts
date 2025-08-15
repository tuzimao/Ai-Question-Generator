import path from 'path';
import { beforeAll, afterAll, beforeEach, test, expect, jest, describe } from '@jest/globals';

import { TestDatabase } from '../utils/database';
import { DocumentTestHelper } from '../helpers/documentHelper';

import DocumentModel, { DocumentIngestStatus } from '../../src/models/Document';
import DocumentSectionModel from '../../src/models/DocumentSection';
import DocumentChunkModel, { EmbeddingStatus } from '../../src/models/DocumentChunk';
import { UserModel } from '../../src/models/User';

import { ChunkService } from '../../src/services/ChunkService';
import EmbeddingService from '../../src/services/EmbeddingService';

import { ChunkingStrategy } from '../../src/models/DocumentChunk';
import { EmbeddingProviderType, VectorStoreType } from '../../src/types/embedding';

jest.setTimeout(30_000);

let TEST_USER_ID!: string;

describe('Embedding 端到端', () => {
  beforeAll(async () => {
    // 如果你已经在 test/setup.ts 做了 ensure/init/migration，可只保留上传目录初始化
    // await TestDatabase.ensureDatabaseExists();
    // await TestDatabase.initialize();
    // await TestDatabase.runMigrations();

    await DocumentTestHelper.initializeUploadDir();
  });

  beforeEach(async () => {
    await TestDatabase.cleanAllTables();

    const now = Date.now();
    const user = await UserModel.create({
      email: `embed+${now}@example.com`,
      username: `embed_user_${now}`,
      password: 'P@ssw0rd!123',
      display_name: 'Embed User',
    });
    TEST_USER_ID = user.id;
  });

  afterAll(async () => {
    await DocumentTestHelper.cleanupUploadDir();
    await TestDatabase.close();
  });

  test('应对已解析文档进行分块并完成向量化（LOCAL + MEMORY）', async () => {
    // 1) 准备内容并创建文档
    const content = [
      '这是第一段文本，用于测试向量化流程。',
      '第二段：我们希望能生成多个 chunk，以验证批量处理。',
      '第三段：在实际项目中，这里可以是 PDF 解析后的内容。',
      '第四段：包含一些 English words to test mixed-language tokenization.',
      '第五段：结束。'
    ].join('\n\n');

    const doc = await DocumentTestHelper.createTestDocument(
      TEST_USER_ID,
      'embed-e2e.txt',
      content,
      'text/plain'
    );

    // 2) 解析（用你已经跑通的 helper）
    const job = await DocumentTestHelper.createAndProcessParseJob(doc, TEST_USER_ID);
    expect(job.status).toBe('completed');

    const parsedDoc = await DocumentModel.findById(doc.doc_id);
    expect(parsedDoc?.ingest_status).toBe(DocumentIngestStatus.PARSED);

    const sections = await DocumentSectionModel.findByDocument(doc.doc_id);
    expect(sections.length).toBeGreaterThan(0);

    // 3) 分块（HYBRID，200/300/30 只为测试快一点）
    const chunkResult = await ChunkService.chunkDocument({
      docId: doc.doc_id,
      userId: TEST_USER_ID,
      config: {
        strategy: ChunkingStrategy.HYBRID,
        targetTokens: 200,
        maxTokens: 300,
        overlapTokens: 30,
        respectBoundaries: true,
        minChunkSize: 20
      }
    });

    expect(chunkResult.chunksCreated).toBeGreaterThan(0);
    const chunksBefore = await DocumentChunkModel.findByDocument(doc.doc_id);
    expect(chunksBefore.length).toBe(chunkResult.chunksCreated);

    const statsBefore = await DocumentChunkModel.getDocumentChunkStats(doc.doc_id);
    const pendingBefore =
      (statsBefore.byStatus?.[EmbeddingStatus.PENDING] ?? 0) +
      (statsBefore.byStatus?.[EmbeddingStatus.PROCESSING] ?? 0) +
      (statsBefore.byStatus?.[EmbeddingStatus.FAILED] ?? 0);
    expect(pendingBefore).toBeGreaterThan(0);

    // 4) 向量化（LOCAL provider + MEMORY store）
    const embedResult = await EmbeddingService.embedDocument({
      docId: doc.doc_id,
      userId: TEST_USER_ID,
      config: {
        provider: EmbeddingProviderType.LOCAL,
        model: 'local-mini-384',     // 你的 LocalEmbeddingProvider 内部可忽略此名，只要维度匹配就行
        dimension: 384,              // ⬅️ 确认和 LocalEmbeddingProvider 一致
        batchSize: 16
      },
      vectorStore: VectorStoreType.MEMORY
    });

    expect(embedResult.chunksProcessed).toBeGreaterThan(0);
    expect(embedResult.chunksFailed).toBe(0);

    // 5) 校验 DB 状态：所有 chunk -> COMPLETED
    const statsAfter = await DocumentChunkModel.getDocumentChunkStats(doc.doc_id);
    const completed = statsAfter.byStatus?.[EmbeddingStatus.COMPLETED] ?? 0;
    expect(completed).toBe(chunksBefore.length);

    // 6) 文档状态 READY
    const finalDoc = await DocumentModel.findById(doc.doc_id);
    expect(finalDoc?.ingest_status).toBe(DocumentIngestStatus.READY);

    // 7) spot check：至少有一个 chunk 有 embedded_at / embedding_model（如果你的模型有这些字段）
    const reloaded = await DocumentChunkModel.findByDocument(doc.doc_id);
    expect(reloaded.length).toBeGreaterThan(0);
    const anyEmbedded = reloaded.some(c =>
      c.embedding_status === EmbeddingStatus.COMPLETED
      // 你的表有 embedded_at / embedding_model 再加上下面两行断言
      // && c['embedded_at']
      // && c['embedding_model']
    );
    expect(anyEmbedded).toBe(true);
  });
});