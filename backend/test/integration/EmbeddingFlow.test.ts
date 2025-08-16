// test/integration/EmbeddingFlow.test.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { TestDatabase } from '../utils/database';
import { DocumentTestHelper } from '../helpers/documentHelper';
import DocumentModel, { DocumentIngestStatus } from '../../src/models/Document';
import DocumentSectionModel from '../../src/models/DocumentSection';
import DocumentChunkModel, { EmbeddingStatus } from '../../src/models/DocumentChunk';
import { ChunkService } from '../../src/services/ChunkService';
import { EmbeddingService } from '../../src/services/EmbeddingService';
import { EmbeddingProviderType, VectorStoreType, EmbeddingConfig } from '../../src/types/embedding';
import { UserModel } from '../../src/models/User';

describe('Embedding Flow 集成测试', () => {
  let TEST_USER_ID!: string;

  beforeAll(async () => {
    // 初始化测试数据库（如果你在 test/setup.ts 已做，这里会是幂等的）
    await TestDatabase.initialize();
    await TestDatabase.runMigrations();

    // 也可以在这里初始化 MinIO 默认桶（DocumentTestHelper 会通过 StorageService 完成）
  });

  beforeEach(async () => {
    // 每次测试前插入一个新用户
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
    // 如果你想查看数据库内容，把 KEEP_TEST_DB=true 放到环境里并注释掉 close
    // await TestDatabase.close();
  });

  it('应完成：上传→解析→分块→向量化（Local + Memory）', async () => {
    // 1) 创建测试文档（走 MinIO 上传 + Document 记录）
    const testContent = [
      '测试标题',
      '',
      '第一段：这是一段用于测试分块与向量化流程的文本。包含一些中文与 English words 混排，便于测试 Token 估算与清洗。',
      '',
      '第二段：为了触发多块切分，我们会放入较长的内容。重复几次以增加长度。',
      '第二段：为了触发多块切分，我们会放入较长的内容。重复几次以增加长度。',
      '第二段：为了触发多块切分，我们会放入较长的内容。重复几次以增加长度。'
    ].join('\n');

    const document = await DocumentTestHelper.createTestDocument(
      TEST_USER_ID,
      'embed-flow.txt',
      testContent,
      'text/plain'
    );

    expect(document.doc_id).toBeTruthy();
    expect(document.ingest_status).toBe(DocumentIngestStatus.UPLOADED);

    // 2) 解析（走 ParseService，真实落库到 document_sections）
    const job = await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);
    expect(job.status).toBe('completed');

    const parsedDoc = await DocumentModel.findById(document.doc_id);
    expect(parsedDoc?.ingest_status).toBe(DocumentIngestStatus.PARSED);

    const sections = await DocumentSectionModel.findByDocument(document.doc_id);
    expect(sections.length).toBeGreaterThan(0);

    // 3) 分块（走 ChunkService）
    const chunkResult = await ChunkService.chunkDocument({
      docId: document.doc_id,
      userId: TEST_USER_ID,
      config: {
        strategy: 'HYBRID' as any,
        targetTokens: 120,
        maxTokens: 160,
        overlapTokens: 20,
        respectBoundaries: true,
        minChunkSize: 40,
      },
    });

    expect(chunkResult.chunksCreated).toBeGreaterThan(0);
    const chunksAfter = await DocumentChunkModel.findByDocument(document.doc_id);
    expect(chunksAfter.length).toBe(chunkResult.chunksCreated);
    expect((await DocumentModel.findById(document.doc_id))?.ingest_status)
      .toBe(DocumentIngestStatus.CHUNKED);

    // 4) 向量化（Local Provider + Memory Store）
    const embeddingConfig: EmbeddingConfig = {
      provider: EmbeddingProviderType.LOCAL,
      model: 'local-mini-384',
      dimension: 384,
      batchSize: 16,
      maxConcurrent: 2,
      retryOnFailure: true,
    };

    const embedResult = await EmbeddingService.embedDocument({
      docId: document.doc_id,
      userId: TEST_USER_ID,
      config: embeddingConfig,
      vectorStore: VectorStoreType.MEMORY,
      onProgress: async (p) => {
        // 需要的话打印进度
        // console.log(`progress ${p.current}/${p.total} - ${p.message}`);
      },
    });

    expect(embedResult.chunksProcessed).toBeGreaterThan(0);
    expect(embedResult.chunksFailed).toBe(0);

    const chunksFinal = await DocumentChunkModel.findByDocument(document.doc_id);
    expect(chunksFinal.every(c => c.embedding_status === EmbeddingStatus.COMPLETED)).toBe(true);

    const finalDoc = await DocumentModel.findById(document.doc_id);
    expect(finalDoc?.ingest_status).toBe(DocumentIngestStatus.READY);

    // ✅ 到这里，Memory 向量存储里也已经写入，但它是进程内内存。
    // 如果你实现了 EmbeddingService.getVectorStoreForTest，可在这里快照验证：
    // const store: any = (EmbeddingService as any).getVectorStoreForTest?.(VectorStoreType.MEMORY);
    // if (store?.debugSnapshot) {
    //   const points = store.debugSnapshot();
    //   expect(points.length).toBe(chunksFinal.length);
    // }
  });

  // ======= 可选：Qdrant 集成用例（需本地/远程 Qdrant）=======
  const hasQdrant = !!process.env.QDRANT_URL; // 仅当配置了 QDRANT_URL 才跑
  (hasQdrant ? it : it.skip)('应完成：解析→分块→向量化（Local + Qdrant）', async () => {
    // 唯一集合名，避免污染
    process.env.QDRANT_COLLECTION_NAME = `documents_test_${Date.now()}`;

    // 准备一个小文档
    const testContent = [
      'Qdrant 向量化测试',
      '',
      '这里是一小段文本，用于验证 upsert 到 Qdrant 的流程是否打通。',
      '加入一些重复句子以增加长度，方便分块。',
      '加入一些重复句子以增加长度，方便分块。'
    ].join('\n');

    const document = await DocumentTestHelper.createTestDocument(
      TEST_USER_ID,
      'embed-qdrant.txt',
      testContent,
      'text/plain'
    );

    const job = await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);
    expect(job.status).toBe('completed');

    const chunkResult = await ChunkService.chunkDocument({
      docId: document.doc_id,
      userId: TEST_USER_ID,
      config: {
        strategy: 'HYBRID' as any,
        targetTokens: 120,
        maxTokens: 160,
        overlapTokens: 20,
        respectBoundaries: true,
        minChunkSize: 40,
      },
    });
    expect(chunkResult.chunksCreated).toBeGreaterThan(0);

    const embeddingConfig: EmbeddingConfig = {
      provider: EmbeddingProviderType.LOCAL, // 先用本地 provider 生成 384 维
      model: 'local-mini-384',
      dimension: 384,
      batchSize: 16,
      maxConcurrent: 2,
      retryOnFailure: true,
    };

    const embedResult = await EmbeddingService.embedDocument({
      docId: document.doc_id,
      userId: TEST_USER_ID,
      config: embeddingConfig,
      vectorStore: VectorStoreType.QDRANT,
    });

    expect(embedResult.chunksProcessed).toBeGreaterThan(0);
    expect(embedResult.chunksFailed).toBe(0);

    const chunksFinal = await DocumentChunkModel.findByDocument(document.doc_id);
    expect(chunksFinal.every(c => c.embedding_status === EmbeddingStatus.COMPLETED)).toBe(true);

    // 如果 QdrantVectorStore 实现了 getStats / search，可做最小校验（可选）
    // const store: any = (EmbeddingService as any).getVectorStoreForTest?.(VectorStoreType.QDRANT);
    // if (store?.getStats) {
    //   const stats = await store.getStats();
    //   expect(stats.totalPoints).toBeGreaterThan(0);
    // }
  });
});