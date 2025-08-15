// backend/test/integration/Chunking.test.ts
import { describe, test, beforeAll, beforeEach, afterAll, expect, jest } from '@jest/globals';
import { UserModel } from '../../src/models/User';
import DocumentModel, { DocumentIngestStatus } from '../../src/models/Document';
import DocumentSectionModel from '../../src/models/DocumentSection';
import DocumentChunkModel from '../../src/models/DocumentChunk';
import { DocumentTestHelper } from '../helpers/documentHelper';
import { ChunkService } from '../../src/services/ChunkService';
import { Database } from '../../src/utils/database';

jest.setTimeout(30_000);

let TEST_USER_ID!: string;

beforeAll(async () => {
  await DocumentTestHelper.initializeUploadDir?.();
});

afterAll(async () => {
  await DocumentTestHelper.cleanupUploadDir?.();
});

beforeEach(async () => {
  const now = Date.now();
  const user = await UserModel.create({
    email: `chunk+${now}@example.com`,
    username: `chunk_user_${now}`,
    password: 'P@ssw0rd!123',
    display_name: 'Chunk User',
  });
  TEST_USER_ID = user.id;
});

describe('ChunkService 端到端', () => {
  test('应对已解析文档进行分块，并写入 document_chunks', async () => {
    // 1) 造一份结构化一点的文本
    const text = [
      '文档标题',
      '',
      '第一段：这是一段用于测试分块逻辑的文本。包含若干中文字符与英文 words 混排。',
      '',
      '第二段：为了触发多块切分，我们会放入较长的内容。'.repeat(10),
      '',
      '第三段：收尾。'
    ].join('\n');

    // 2) 创建文档（会上传到 MinIO），状态应为 UPLOADED
    const doc = await DocumentTestHelper.createTestDocument(
      TEST_USER_ID,
      'chunking.txt',
      text,
      'text/plain'
    );

    expect(doc.doc_id).toBeTruthy();
    expect(doc.ingest_status).toBe(DocumentIngestStatus.UPLOADED);

    // 3) 创建解析作业并同步处理（生成 sections）
    const job = await DocumentTestHelper.createAndProcessParseJob(doc, TEST_USER_ID);
    expect(job.status).toBe('completed');

    // 4) 文档应为 PARSED
    const parsed = await DocumentModel.findById(doc.doc_id);
    expect(parsed?.ingest_status).toBe(DocumentIngestStatus.PARSED);

    // 5) 调用 ChunkService（MVP 配置：400/500/60）
    const result = await ChunkService.chunkDocument({
      docId: doc.doc_id,
      userId: TEST_USER_ID,
      config: {
        strategy: 'HYBRID' as any, // 或 ChunkingStrategy.HYBRID
        targetTokens: 400,
        maxTokens: 500,
        overlapTokens: 60,
        respectBoundaries: true,
        minChunkSize: 50,
      },
    });

    // 6) 断言输出
    expect(result.docId).toBe(doc.doc_id);
    expect(result.chunksCreated).toBeGreaterThan(0);
    expect(result.sectionsProcessed).toBeGreaterThan(0);

    // 7) 从数据库拉取 chunk 验证
    const chunks = await DocumentChunkModel.findByDocument(doc.doc_id, { sortBy: 'chunk_index', sortOrder: 'asc' });
    expect(chunks.length).toBe(result.chunksCreated);

    // 8) 基本顺序 & 边界检查
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      expect(c.doc_id).toBe(doc.doc_id);
      expect(c.start_char).toBeLessThan(c.end_char);
      // 单块字符长度合理（MVP 级别，只做下限检查）
      expect(c.char_count || (c.content?.length ?? 0)).toBeGreaterThanOrEqual(10);
      if (i > 0) {
        expect(c.start_char).toBeLessThanOrEqual(chunks[i - 1].end_char); // 允许重叠
      }
    }

    // 9) 输出快照（仅在你想保留数据时）
    if (process.env.KEEP_TEST_DB === 'true') {
      const db = Database.getInstance();
      const peek = await db('document_chunks')
        .select('chunk_id', 'chunk_index', 'start_char', 'end_char', 'token_count')
        .where('doc_id', doc.doc_id)
        .orderBy('chunk_index', 'asc')
        .limit(5);
      console.log('🔎 chunks snapshot:', peek);

      const first = await db('document_chunks')
        .select('content')
        .where({ doc_id: doc.doc_id })
        .orderBy('chunk_index', 'asc')
        .first();
      if (first) {
        console.log('🔎 first chunk preview:', String(first.content).slice(0, 160));
      }
    }

    // 10) 文档状态应更新为 CHUNKED（取决于你的实现）
    const after = await DocumentModel.findById(doc.doc_id);
    // 如果你实现了 CHUNKED，就断言它；否则这行注释掉
    // expect(after?.ingest_status).toBe(DocumentIngestStatus.CHUNKED);
    expect(chunks.length).toBeGreaterThan(0);
  });
});