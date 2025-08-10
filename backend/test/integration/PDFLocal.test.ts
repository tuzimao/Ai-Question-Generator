import { describe, test, beforeAll, beforeEach, afterAll, expect, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { UserModel } from '../../src/models/User';
import DocumentSectionModel from '../../src/models/DocumentSection';
import { DocumentService } from '../../src/services/DocumentService';
import { DocumentTestHelper } from '../helpers/documentHelper';
import { JobStatus } from '../../src/models/ProcessingJob';
import { DocumentIngestStatus } from '../../src/models/Document';

jest.setTimeout(30_000);

let TEST_USER_ID!: string;

beforeAll(async () => {
  await DocumentTestHelper.initializeUploadDir();
});

afterAll(async () => {
  await DocumentTestHelper.cleanupUploadDir();
});

beforeEach(async () => {
  const now = Date.now();
  const user = await UserModel.create({
    email: `pdf-local+${now}@example.com`,
    username: `pdf_local_${now}`,
    password: 'P@ssw0rd!123',
    display_name: 'PDF Local',
  });
  TEST_USER_ID = user.id;
});

describe('本地 PDF 端到端解析', () => {
  test('解析 backend/test/uec78284.pdf', async () => {
    // 1) 读取本地 PDF（注意路径从项目根开始）
    const pdfPath = path.resolve(process.cwd(), 'test/testtest.pdf');
    const buf = await fs.readFile(pdfPath);

    // 2) 上传到 MinIO（用你统一后的 mockUploadResult：支持 Buffer）
    const uploadResult = await DocumentTestHelper.mockUploadResult(
      'testtest.pdf',
      buf,
      'application/pdf',
      'uploads' // 或 'documents'：与 StorageService 默认桶保持一致即可
    );

    // 3) 创建文档（会创建解析作业）
    const createRes = await DocumentService.createDocument({
      userId: TEST_USER_ID,
      uploadResult,
      metadata: { source: 'local-file-test' },
    });

    expect(createRes.document).toBeDefined();
    expect(createRes.document.ingest_status).toBe(DocumentIngestStatus.UPLOADED);

    // 4) 直接同步跑解析作业（复用你的 helper）
    const job = await DocumentTestHelper.createAndProcessParseJob(createRes.document, TEST_USER_ID);
    expect(job.status).toBe(JobStatus.COMPLETED);

    // 5) 看下章节 & 状态
    const sections = await DocumentSectionModel.findByDocument(createRes.document.doc_id);
    console.log('🔎 sections count =', sections.length);
    if (sections[0]) {
      console.log('🔎 first section snippet =', (sections[0].content || '').slice(0, 120));
    }

    const updatedDoc = await (await import('../../src/models/Document')).default.findById(
      createRes.document.doc_id
    );
    expect(updatedDoc?.ingest_status).toBe(DocumentIngestStatus.PARSED);
    expect((updatedDoc?.page_count ?? 0)).toBeGreaterThanOrEqual(1);
  });
});