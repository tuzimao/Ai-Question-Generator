// backend/test/integration/DocumentParsing.test.ts
import { DocumentTestHelper } from '../helpers/documentHelper';
import DocumentModel, { DocumentIngestStatus } from '../../src/models/Document';
import DocumentSectionModel from '../../src/models/DocumentSection';
import ProcessingJobModel, { JobStatus } from '../../src/models/ProcessingJob';
import { DocumentService } from '../../src/services/DocumentService';
import { UserModel } from '../../src/models/User';
import { expect, test, beforeEach, describe, beforeAll, afterAll, jest } from '@jest/globals';

describe('文档解析端到端测试', () => {
  jest.setTimeout(30_000);

  let TEST_USER_ID!: string;

  // 这里只处理与文件系统相关的准备/清理；数据库在 test/setup.ts 统一处理
  beforeAll(async () => {
    await DocumentTestHelper.initializeUploadDir();
  });

  afterAll(async () => {
    await DocumentTestHelper.cleanupUploadDir();
  });

  // 每个测试开始前创建一个用户（数据库已由全局 afterEach 清表）
  beforeEach(async () => {
    const now = Date.now();
    const user = await UserModel.create({
      email: `test+${now}@example.com`,
      username: `testuser_${now}`,
      password: 'P@ssw0rd!123',
      display_name: 'Test User',
    });
    TEST_USER_ID = user.id;
  });

  describe('文本文档解析', () => {
    test('应该成功解析纯文本文档', async () => {
      const testContent = `测试标题

这是第一段内容。
包含多行文本。

第二章 章节标题

这是第二段的内容，用于测试段落分割。
文档解析应该能识别出不同的段落。`;

      const document = await DocumentTestHelper.createTestDocument(
        TEST_USER_ID,
        'test.txt',
        testContent,
        'text/plain'
      );

      expect(document.doc_id).toBeTruthy();
      expect(document.ingest_status).toBe(DocumentIngestStatus.UPLOADED);

      const job = await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);
      expect(job.status).toBe(JobStatus.COMPLETED);

      const updatedDoc = await DocumentModel.findById(document.doc_id);
      expect(updatedDoc?.ingest_status).toBe(DocumentIngestStatus.PARSED);
      expect(updatedDoc?.text_length).toBeGreaterThan(0);

      const sections = await DocumentSectionModel.findByDocument(document.doc_id);
      expect(sections.length).toBeGreaterThan(0);
      const sectionContents = sections.map(s => s.content ?? '');
      expect(sectionContents.some(c => c.includes('测试标题'))).toBe(true);
      expect(sectionContents.some(c => c.includes('第一段内容'))).toBe(true);
      expect(sectionContents.some(c => c.includes('第二段的内容'))).toBe(true);

      expect(sections[0]?.section_order).toBe(0);
      if (sections[1]) expect(sections[1].section_order).toBe(1);
    });
  });

  test('应该正确识别标题和段落', async () => {
    const testContent = DocumentTestHelper.generateTestContent(3);
    const document = await DocumentTestHelper.createTestDocument(
      TEST_USER_ID,
      'structured.txt',
      testContent,
      'text/plain'
    );

    await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);

    const sections = await DocumentSectionModel.findByDocument(document.doc_id);
    const titles = sections.filter(s => s.title);
    expect(titles.length).toBeGreaterThan(0);

    const chapterTitles = titles.filter(t => t.title?.includes('章节标题'));
    expect(chapterTitles.length).toBeGreaterThan(0);
  });

  test('应该处理空文档', async () => {
    const document = await DocumentTestHelper.createTestDocument(
      TEST_USER_ID,
      'empty.txt',
      '',
      'text/plain'
    );

    await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);
    const sections = await DocumentSectionModel.findByDocument(document.doc_id);
    expect(sections.length).toBe(0);
  });

  test('应该处理大文档', async () => {
    const largeContent = DocumentTestHelper.generateTestContent(100);
    const document = await DocumentTestHelper.createTestDocument(
      TEST_USER_ID,
      'large.txt',
      largeContent,
      'text/plain'
    );

    await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);
    const sections = await DocumentSectionModel.findByDocument(document.doc_id);
    expect(sections.length).toBeGreaterThan(50);
    sections.forEach(section => {
      expect(section.content).toBeDefined();
      expect(section.content?.length).toBeGreaterThan(0);
      expect(section.start_char).toBeGreaterThanOrEqual(0);
      expect(section.end_char).toBeGreaterThan(section.start_char);
    });
  });

  describe('文档服务集成测试', () => {
    test('应该通过DocumentService完成完整流程', async () => {
      const uploadResult = await DocumentTestHelper.mockUploadResult(
        'service-test.txt',
        '服务测试内容\n\n第二段内容'
      );

      const result = await DocumentService.createDocument({
        userId: TEST_USER_ID,
        uploadResult,
        metadata: { source: 'test' },
      });

      expect(result.document).toBeDefined();
      expect(result.processingJob).toBeDefined();

      const detail = await DocumentService.getDocumentDetail(
        result.document.doc_id,
        TEST_USER_ID,
        true
      );

      expect(detail).toBeDefined();
      expect(detail?.processingJobs?.length).toBeGreaterThan(0);
    });

    test('应该正确处理重复文档', async () => {
      const content = '重复测试内容';

      const uploadResult1 = await DocumentTestHelper.mockUploadResult('duplicate1.txt', content);
      const result1 = await DocumentService.createDocument({ userId: TEST_USER_ID, uploadResult: uploadResult1 });

      const uploadResult2 = await DocumentTestHelper.mockUploadResult('duplicate2.txt', content);
      const result2 = await DocumentService.createDocument({ userId: TEST_USER_ID, uploadResult: uploadResult2 });

      expect(result2.existingDocument).toBe(true);
      expect(result2.document.doc_id).toBe(result1.document.doc_id);
    });
  });

  describe('错误处理', () => {
    test('应该处理无效的MIME类型', async () => {
      const document = await DocumentTestHelper.createTestDocument(
        TEST_USER_ID,
        'invalid.xyz',
        'content',
        'application/unknown'
      );

      await expect(
        DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID)
      ).rejects.toThrow(/不支持/);
    });
  });
});
