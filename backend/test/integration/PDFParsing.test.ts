// backend/test/integration/PDFParsing.test.ts
import { describe, test, beforeAll, afterAll, beforeEach, expect, jest } from '@jest/globals';
import PDFDocument from 'pdfkit';
import { UserModel } from '../../src/models/User';
import DocumentSectionModel from '../../src/models/DocumentSection';
import { DocumentService } from '../../src/services/DocumentService';
import { DocumentTestHelper } from '../helpers/documentHelper';
import { JobStatus } from '../../src/models/ProcessingJob';
import { DocumentIngestStatus } from '../../src/models/Document';

jest.setTimeout(30_000);

// 1) 小工具：生成 PDF Buffer（两页）
async function createPdfBuffer(pages: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc: any = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    pages.forEach((text, idx) => {
      if (idx > 0) doc.addPage();
      doc.fontSize(14).text(text);
    });

    doc.end();
  });
}

describe('PDF 解析端到端（pdf-parse）', () => {
  let TEST_USER_ID!: string;

  // 仅处理上传目录；数据库的 init/migrate/clean/close 已在 test/setup.ts 全局处理
  beforeAll(async () => {
    await DocumentTestHelper.initializeUploadDir();
  });

  afterAll(async () => {
    await DocumentTestHelper.cleanupUploadDir();
  });

  beforeEach(async () => {
    const now = Date.now();
    const user = await UserModel.create({
      email: `pdf+${now}@example.com`,
      username: `pdf_user_${now}`,
      password: 'P@ssw0rd!123',
      display_name: 'PDF User',
    });
    TEST_USER_ID = user.id;
  });

  test('应成功解析两页 PDF（按页生成章节）', async () => {
    // 准备两页内容
    const buf = await createPdfBuffer([
      'Page 1 Title\n\nThis is the first page content. Line A.\nLine B.',
      'Page 2 Title\n\nThis is the second page content. Line C.',
    ]);

    // 2) 上传至 MinIO，获得 uploadResult
    // 需要你已按之前建议在 DocumentTestHelper 中实现
    // mockUploadResultFromBuffer(name, buffer, mime)
    const uploadResult = await DocumentTestHelper.mockUploadResult(
      'sample.pdf',
      buf,
      'application/pdf'
    );

    // 3) 创建文档（触发作业创建）
    const createRes = await DocumentService.createDocument({
      userId: TEST_USER_ID,
      uploadResult,
      metadata: { source: 'e2e-test' },
    });

    expect(createRes.document).toBeDefined();
    expect(createRes.document.ingest_status).toBe(DocumentIngestStatus.UPLOADED);

    // 4) 同步处理解析作业（跑完整个 ParseService 流程）
    const job = await DocumentTestHelper.createAndProcessParseJob(
      createRes.document,
      TEST_USER_ID
    );
    expect(job.status).toBe(JobStatus.COMPLETED);

    // 5) 读取章节并断言
    const sections = await DocumentSectionModel.findByDocument(createRes.document.doc_id);
    expect(sections.length).toBeGreaterThanOrEqual(2);

    // 默认排序已按 section_order/start_page/start_char 修好
    const s1 = sections[0]!;
    const s2 = sections[1]!;

    // 断言页码（第一页、第二页）
    expect(s1.start_page).toBe(1);
    expect(s1.end_page).toBe(1);
    expect(s2.start_page).toBe(2);
    expect(s2.end_page).toBe(2);

    // 断言内容包含关键字
    expect((s1.content ?? '')).toMatch(/first page content/i);
    expect((s2.content ?? '')).toMatch(/second page content/i);

    // 文档状态应更新为已解析
    const updatedDoc = await (await import('../../src/models/Document')).default.findById(
      createRes.document.doc_id
    );
    expect(updatedDoc?.ingest_status).toBe(DocumentIngestStatus.PARSED);
    expect((updatedDoc?.page_count ?? 0)).toBeGreaterThanOrEqual(2);
  });
});