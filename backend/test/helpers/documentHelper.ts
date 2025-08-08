// backend/test/helpers/documentHelper.ts
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { FileUploadResult } from '../../src/services/FileUploadService';
import DocumentModel, { Document, CreateDocumentRequest } from '../../src/models/Document';
import ProcessingJobModel, { ProcessingJob, JobType } from '../../src/models/ProcessingJob';

export class DocumentTestHelper {
  private static testUploadDir = path.join(__dirname, '../uploads');

  /**
   * 初始化测试上传目录
   */
  static async initializeUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.testUploadDir, { recursive: true });
    } catch (error) {
      console.error('创建测试上传目录失败:', error);
    }
  }

  /**
   * 清理测试上传目录
   */
  static async cleanupUploadDir(): Promise<void> {
    try {
      await fs.rm(this.testUploadDir, { recursive: true, force: true });
    } catch (error) {
      console.error('清理测试上传目录失败:', error);
    }
  }

  /**
   * 创建测试文件
   */
  static async createTestFile(
    filename: string, 
    content: string
  ): Promise<string> {
    const filePath = path.join(this.testUploadDir, filename);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * 模拟文件上传结果
   */
  static async mockUploadResult(
    filename: string,
    content: string,
    mimeType: string = 'text/plain'
  ): Promise<FileUploadResult> {
    const fileId = uuidv4();
    const filePath = await this.createTestFile(`${fileId}_${filename}`, content);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    
    return {
      fileId,
      originalName: filename,
      storagePath: filePath,
      storageBucket: 'test-documents',
      size: Buffer.byteLength(content, 'utf8'),
      mimeType,
      contentHash,
      uploadDate: new Date()
    };
  }

  /**
   * 创建测试文档
   */
  static async createTestDocument(
    userId: string,
    filename: string,
    content: string,
    mimeType: string = 'text/plain'
  ): Promise<Document> {
    const uploadResult = await this.mockUploadResult(filename, content, mimeType);
    
    const createRequest: CreateDocumentRequest = {
      user_id: userId,
      filename: uploadResult.originalName,
      content_hash: uploadResult.contentHash,
      mime_type: uploadResult.mimeType,
      size_bytes: uploadResult.size,
      storage_path: uploadResult.storagePath,
      storage_bucket: uploadResult.storageBucket,
      metadata: {
        test: true,
        uploadedAt: new Date().toISOString()
      }
    };

    return await DocumentModel.create(createRequest);
  }

  /**
   * 创建并处理解析作业
   */
  static async createAndProcessParseJob(
    document: Document,
    userId: string
  ): Promise<ProcessingJob> {
    // 创建解析作业
    const job = await ProcessingJobModel.create({
      doc_id: document.doc_id,
      user_id: userId,
      job_type: this.getJobTypeForMimeType(document.mime_type),
      queue_name: 'document-processing',
      input_params: {
        filePath: document.storage_path,
        mimeType: document.mime_type,
        bucket: document.storage_bucket
      }
    });

    // 模拟Worker处理（直接调用ParseService）
    const { ParseService } = await import('../../src/services/ParseService');
    
    await ParseService.parseDocument({
      docId: document.doc_id,
      userId: userId,
      filePath: document.storage_path,
      bucket: document.storage_bucket,
      mimeType: document.mime_type,
      config: {
        extractImages: false,
        preserveFormatting: true,
        titleDetection: 'auto',
        cleanHeaderFooter: true
      }
    });

    // 更新作业状态
    await ProcessingJobModel.completeJob(job.job_id, { success: true });
    
    return await ProcessingJobModel.findById(job.job_id) as ProcessingJob;
  }

  /**
   * 根据MIME类型获取作业类型
   */
  private static getJobTypeForMimeType(mimeType: string): JobType {
    switch (mimeType) {
      case 'application/pdf':
        return JobType.PARSE_PDF;
      case 'text/markdown':
      case 'text/x-markdown':
        return JobType.PARSE_MARKDOWN;
      case 'text/plain':
      default:
        return JobType.PARSE_TEXT;
    }
  }

  /**
   * 生成测试文本内容
   */
  static generateTestContent(paragraphs: number = 3): string {
    const content: string[] = [];
    
    content.push('测试文档标题');
    content.push('');
    
    for (let i = 1; i <= paragraphs; i++) {
      content.push(`第${i}章 章节标题${i}`);
      content.push('');
      content.push(`这是第${i}段的内容。这里包含了一些测试文本，用于验证文档解析功能是否正常工作。`);
      content.push(`段落中还包含了更多的内容，以确保解析器能够正确处理多行文本。`);
      content.push('');
    }
    
    return content.join('\n');
  }
}