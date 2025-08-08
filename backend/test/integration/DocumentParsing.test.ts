// backend/test/integration/DocumentParsing.test.ts
import { TestDatabase } from '../utils/database';
import { DocumentTestHelper } from '../helpers/documentHelper';
import DocumentModel, { DocumentIngestStatus } from '../../src/models/Document';
import DocumentSectionModel from '../../src/models/DocumentSection';
import ProcessingJobModel, { JobStatus } from '../../src/models/ProcessingJob';
import { DocumentService } from '../../src/services/DocumentService';
import {  expect, test, beforeEach, describe, beforeAll, afterAll } from '@jest/globals';

describe('文档解析端到端测试', () => {
  const TEST_USER_ID = 'test-user-001';
  
  // 初始化测试环境
  beforeAll(async () => {
    await TestDatabase.initialize();
    await TestDatabase.runMigrations();
    await DocumentTestHelper.initializeUploadDir();
  });

  // 清理测试环境
  afterAll(async () => {
    await DocumentTestHelper.cleanupUploadDir();
    await TestDatabase.close();
  });

  // 每个测试前清理数据
  beforeEach(async () => {
    await TestDatabase.cleanAllTables();
  });

  describe('文本文档解析', () => {
    test('应该成功解析纯文本文档', async () => {
      // 1. 准备测试内容
      const testContent = `测试标题

这是第一段内容。
包含多行文本。

第二章 章节标题

这是第二段的内容，用于测试段落分割。
文档解析应该能识别出不同的段落。`;

      // 2. 创建测试文档
      const document = await DocumentTestHelper.createTestDocument(
        TEST_USER_ID,
        'test.txt',
        testContent,
        'text/plain'
      );
      
      expect(document).toBeDefined();
      expect(document.doc_id).toBeTruthy();
      expect(document.ingest_status).toBe(DocumentIngestStatus.UPLOADED);

      // 3. 创建并处理解析作业
      const job = await DocumentTestHelper.createAndProcessParseJob(
        document,
        TEST_USER_ID
      );
      
      expect(job.status).toBe(JobStatus.COMPLETED);

      // 4. 验证文档状态更新
      const updatedDoc = await DocumentModel.findById(document.doc_id);
      expect(updatedDoc).toBeDefined();
      expect(updatedDoc?.ingest_status).toBe(DocumentIngestStatus.PARSED);
      expect(updatedDoc?.text_length).toBeGreaterThan(0);

      // 5. 验证章节数据
      const sections = await DocumentSectionModel.findByDocument(document.doc_id);
      expect(sections).toBeDefined();
      expect(sections.length).toBeGreaterThan(0);
      
      // 验证章节内容
      const sectionContents = sections.map(s => s.content);
      expect(sectionContents.some(c => c?.includes('测试标题'))).toBe(true);
      expect(sectionContents.some(c => c?.includes('第一段内容'))).toBe(true);
      expect(sectionContents.some(c => c?.includes('第二段的内容'))).toBe(true);
      
      // 验证章节顺序
      expect(sections[0]?.section_order).toBe(0);
      if (sections[1]) {
        expect(sections[1].section_order).toBe(1);
      }
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
      
      // 验证标题识别
      const titles = sections.filter(s => s.title);
      expect(titles.length).toBeGreaterThan(0);
      
      // 验证是否识别出了章节标题
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
      // 生成大文档（100个段落）
      const largeContent = DocumentTestHelper.generateTestContent(100);
      
      const document = await DocumentTestHelper.createTestDocument(
        TEST_USER_ID,
        'large.txt',
        largeContent,
        'text/plain'
      );

      await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);

      const sections = await DocumentSectionModel.findByDocument(document.doc_id);
      expect(sections.length).toBeGreaterThan(50); // 至少应该有50个章节
      
      // 验证所有章节都有内容
      sections.forEach(section => {
        expect(section.content).toBeDefined();
        expect(section.content?.length).toBeGreaterThan(0);
        expect(section.start_char).toBeGreaterThanOrEqual(0);
        expect(section.end_char).toBeGreaterThan(section.start_char);
      });
    });
  });

  describe('文档服务集成测试', () => {
    test('应该通过DocumentService完成完整流程', async () => {
      // 模拟文件上传结果
      const uploadResult = await DocumentTestHelper.mockUploadResult(
        'service-test.txt',
        '服务测试内容\n\n第二段内容'
      );

      // 通过DocumentService创建文档
      const result = await DocumentService.createDocument({
        userId: TEST_USER_ID,
        uploadResult,
        metadata: { source: 'test' }
      });

      expect(result.document).toBeDefined();
      expect(result.processingJob).toBeDefined();
      
      // 获取文档详情
      const detail = await DocumentService.getDocumentDetail(
        result.document.doc_id,
        TEST_USER_ID,
        true
      );

      expect(detail).toBeDefined();
      expect(detail?.processingJobs).toBeDefined();
      expect(detail?.processingJobs?.length).toBeGreaterThan(0);
    });

    test('应该正确处理重复文档', async () => {
      const content = '重复测试内容';
      
      // 创建第一个文档
      const uploadResult1 = await DocumentTestHelper.mockUploadResult(
        'duplicate1.txt',
        content
      );
      
      const result1 = await DocumentService.createDocument({
        userId: TEST_USER_ID,
        uploadResult: uploadResult1
      });

      // 创建相同内容的第二个文档
      const uploadResult2 = await DocumentTestHelper.mockUploadResult(
        'duplicate2.txt',
        content  // 相同内容
      );
      
      const result2 = await DocumentService.createDocument({
        userId: TEST_USER_ID,
        uploadResult: uploadResult2
      });

      // 应该返回相同的文档
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

      // 这里应该抛出错误或者标记为失败
      try {
        await DocumentTestHelper.createAndProcessParseJob(document, TEST_USER_ID);
      } catch (error: any) {
        expect(error.message).toContain('不支持');
      }
    });
  });
});