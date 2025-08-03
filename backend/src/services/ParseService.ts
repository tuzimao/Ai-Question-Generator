// src/services/ParseService.ts - 文档解析服务主入口

import { Readable } from 'stream';
import { Knex } from 'knex';
import { Database } from '@/utils/database';
import DocumentModel, { Document, DocumentIngestStatus } from '@/models/Document';
import DocumentSectionModel from '@/models/DocumentSection';
import ProcessingJobModel from '@/models/ProcessingJob';
import { StorageService } from '@/services/StorageService';
import { 
  ParseRequest, 
  ParseResult, 
  ParseProgress, 
  ParseStage, 
  ParseError, 
  ParseErrorType,
  ParseConfig,
  ParsedSection
} from '@/types/parse';
import { ProgressUpdate } from '@/types/worker';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 文档解析服务
 * 
 * 职责：
 * - 协调文档解析过程
 * - 提供幂等性保护
 * - 管理解析进度
 * - 处理错误和重试
 * - 保存解析结果
 */
export class ParseService {
  private static readonly VERSION = '1.0.0';
  
  /**
   * 解析文档
   * @param request 解析请求
   * @param onProgress 进度回调函数
   * @returns 解析结果
   */
  public static async parseDocument(
    request: ParseRequest,
    onProgress?: (progress: ProgressUpdate) => Promise<void>
  ): Promise<ParseResult> {
    const { docId, userId } = request;
    
    console.log(`📄 开始解析文档: ${docId} (用户: ${userId})`);
    
    try {
      // 第一步：幂等性检查
      await this.updateProgress(onProgress, {
        current: 5,
        total: 100,
        message: '检查文档状态...'
      });
      
      const idempotencyCheck = await this.checkIdempotency(docId);
      if (idempotencyCheck.shouldSkip) {
        console.log(`♻️ 文档已解析，跳过处理: ${docId}`);
        return idempotencyCheck.existingResult!;
      }
      
      // 第二步：读取文档信息
      await this.updateProgress(onProgress, {
        current: 10,
        total: 100,
        message: '读取文档信息...'
      });
      
      const document = await DocumentModel.findById(docId);
      if (!document) {
        throw new ParseError(ParseErrorType.FILE_NOT_FOUND, `文档不存在: ${docId}`);
      }
      
      // 验证文档状态
      if (document.ingest_status !== DocumentIngestStatus.UPLOADED) {
        throw new ParseError(
          ParseErrorType.PARSING_FAILED, 
          `文档状态不正确: ${document.ingest_status}`
        );
      }
      
      // 第三步：更新文档状态为解析中
      await this.updateDocumentStatus(docId, DocumentIngestStatus.PARSING);
      
      // 第四步：从存储读取文件
      await this.updateProgress(onProgress, {
        current: 20,
        total: 100,
        message: '从存储读取文件...'
      });
      
      const fileStream = await this.readFileFromStorage(request);
      
      // 第五步：选择解析器并解析
      await this.updateProgress(onProgress, {
        current: 30,
        total: 100,
        message: '开始解析文档内容...'
      });
      
      const parseResult = await this.performParsing(request, fileStream, onProgress);
      
      // 第六步：保存解析结果
      await this.updateProgress(onProgress, {
        current: 90,
        total: 100,
        message: '保存解析结果...'
      });
      
      await this.saveParseResults(docId, parseResult);
      
      // 第七步：更新文档状态为已解析
      await this.updateDocumentStatus(
        docId, 
        DocumentIngestStatus.PARSED, 
        parseResult.stats
      );
      
      await this.updateProgress(onProgress, {
        current: 100,
        total: 100,
        message: '解析完成'
      });
      
      console.log(`✅ 文档解析完成: ${docId} (${parseResult.sections.length}个章节)`);
      
      return parseResult;
      
    } catch (error) {
      console.error(`❌ 文档解析失败: ${docId}`, error);
      
      // 更新文档状态为失败
      await this.updateDocumentStatus(
        docId, 
        DocumentIngestStatus.FAILED, 
        undefined,
        getErrorMessage(error)
      );
      
      // 重新抛出错误
      if (error instanceof ParseError) {
        throw error;
      } else {
        throw new ParseError(
          ParseErrorType.UNKNOWN_ERROR,
          `解析失败: ${getErrorMessage(error)}`,
          error
        );
      }
    }
  }
  
  /**
   * 检查幂等性
   */
  private static async checkIdempotency(docId: string): Promise<{
    shouldSkip: boolean;
    existingResult?: ParseResult;
  }> {
    try {
      // 检查是否已有章节数据
      const sectionCount = await Database.withTransaction(async (trx: Knex.Transaction) => {
        const result = await trx('document_sections')
          .where('doc_id', docId)
          .count('section_id as count')
          .first();
        return Number(result?.count) || 0;
      });
      
      if (sectionCount > 0) {
        console.log(`📋 发现已存在的章节数据: ${sectionCount}个章节`);
        
        // 获取现有的解析结果
        const existingResult = await this.getExistingParseResult(docId);
        return {
          shouldSkip: true,
          existingResult
        };
      }
      
      return { shouldSkip: false };
      
    } catch (error) {
      console.warn('幂等性检查失败，继续处理:', error);
      return { shouldSkip: false };
    }
  }
  
  /**
   * 获取现有的解析结果
   */
  private static async getExistingParseResult(docId: string): Promise<ParseResult> {
    // 从数据库重建解析结果
    const document = await DocumentModel.findById(docId);
    const sections = await DocumentSectionModel.findByDocument(docId);
    
    if (!document) {
      throw new ParseError(ParseErrorType.FILE_NOT_FOUND, `文档不存在: ${docId}`);
    }
    
    // 转换数据库记录为ParsedSection格式
    const parsedSections: ParsedSection[] = sections.map(section => ({
      path: section.section_order.toString(), // 简化处理
      title: section.title || undefined,
      text: section.content || '',
      startPage: section.start_page || undefined,
      endPage: section.end_page || undefined,
      level: section.level,
      startChar: section.start_char,
      endChar: section.end_char,
      type: this.mapSectionType(section.section_type),
      confidence: section.confidence_score || undefined,
      metadata: section.metadata
    }));
    
    // 构建解析结果
    const rawText = parsedSections.map(s => s.text).join('\n');
    
    return {
      sections: parsedSections,
      rawText,
      stats: {
        pageCount: document.page_count || undefined,
        bytes: document.size_bytes,
        sectionCount: parsedSections.length,
        totalChars: rawText.length,
        estimatedTokens: document.token_estimate || undefined,
        parseTime: 0, // 历史数据
        detectedLanguage: document.language || undefined
      },
      metadata: {
        title: document.metadata?.title,
        // 其他元数据...
      }
    };
  }
  
  /**
   * 从存储读取文件
   */
  private static async readFileFromStorage(request: ParseRequest): Promise<Readable> {
    try {
      const storageService = new StorageService();
      const stream = await storageService.getFileStream(request.bucket, request.filePath);
      
      if (!stream) {
        throw new ParseError(
          ParseErrorType.FILE_NOT_FOUND, 
          `无法从存储读取文件: ${request.filePath}`
        );
      }
      
      return stream;
      
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      throw new ParseError(
        ParseErrorType.FILE_NOT_FOUND,
        `存储访问失败: ${getErrorMessage(error)}`,
        error
      );
    }
  }
  
  /**
   * 执行文档解析
   */
  private static async performParsing(
    request: ParseRequest,
    fileStream: Readable,
    onProgress?: (progress: ProgressUpdate) => Promise<void>
  ): Promise<ParseResult> {
    // 获取解析器工厂
    const { ParserFactory } = await import('@/parsers/ParserFactory');
    
    try {
      // 创建解析器
      const parser = ParserFactory.createParser(request.mimeType);
      
      console.log(`🔧 使用解析器: ${parser.name} (MIME: ${request.mimeType})`);
      
      // 将流转换为临时文件（简化处理）
      const tempFilePath = await this.streamToTempFile(fileStream, request.docId);
      
      try {
        // 执行解析
        const result = await parser.parse(tempFilePath, request.config);
        
        // 清理临时文件
        await this.cleanupTempFile(tempFilePath);
        
        return result;
        
      } catch (parseError) {
        // 清理临时文件
        await this.cleanupTempFile(tempFilePath);
        throw parseError;
      }
      
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      
      throw new ParseError(
        ParseErrorType.PARSING_FAILED,
        `解析执行失败: ${getErrorMessage(error)}`,
        error
      );
    }
  }
  
  /**
   * 保存解析结果
   */
  private static async saveParseResults(
    docId: string, 
    parseResult: ParseResult
  ): Promise<void> {
    await Database.withTransaction(async (trx: Knex.Transaction) => {
      try {
        // 删除现有的章节数据（幂等性保护）
        await trx('document_sections')
          .where('doc_id', docId)
          .del();
        
        // 批量插入新的章节数据
        if (parseResult.sections.length > 0) {
          const sectionRecords = parseResult.sections.map((section, index) => ({
            section_id: this.generateSectionId(),
            doc_id: docId,
            parent_section_id: null, // 简化处理，后续可以构建层级关系
            level: section.level,
            title: section.title || null,
            section_order: index,
            section_type: this.mapToDbSectionType(section.type),
            content: section.text,
            content_cleaned: section.text, // 后续由TextNormalizer处理
            token_count: null, // 后续计算
            start_page: section.startPage || null,
            end_page: section.endPage || null,
            start_char: section.startChar,
            end_char: section.endChar,
            confidence_score: section.confidence || null,
            extraction_status: 'extracted',
            metadata: section.metadata ? JSON.stringify(section.metadata) : null,
            created_at: new Date(),
            updated_at: new Date()
          }));
          
          // 分批插入（MySQL有单次插入限制）
          const batchSize = 100;
          for (let i = 0; i < sectionRecords.length; i += batchSize) {
            const batch = sectionRecords.slice(i, i + batchSize);
            await trx('document_sections').insert(batch);
          }
        }
        
        console.log(`💾 保存 ${parseResult.sections.length} 个章节到数据库`);
        
      } catch (error) {
        console.error('保存解析结果失败:', error);
        throw new ParseError(
          ParseErrorType.UNKNOWN_ERROR,
          `保存解析结果失败: ${getErrorMessage(error)}`,
          error
        );
      }
    });
  }
  
  /**
   * 更新文档状态
   */
  private static async updateDocumentStatus(
    docId: string,
    status: DocumentIngestStatus,
    stats?: any,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        ingest_status: status,
        updated_at: new Date()
      };
      
      if (stats) {
        updateData.page_count = stats.pageCount;
        updateData.language = stats.detectedLanguage;
        updateData.text_length = stats.totalChars;
        updateData.token_estimate = stats.estimatedTokens;
      }
      
      if (status === DocumentIngestStatus.PARSING) {
        updateData.parsing_started_at = new Date();
      } else if (status === DocumentIngestStatus.PARSED) {
        updateData.parsing_completed_at = new Date();
      } else if (status === DocumentIngestStatus.FAILED) {
        updateData.error_message = errorMessage;
      }
      
      await DocumentModel.update(docId, updateData);
      
    } catch (error) {
      console.error('更新文档状态失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }
  
  /**
   * 更新进度
   */
  private static async updateProgress(
    onProgress: ((progress: ProgressUpdate) => Promise<void>) | undefined,
    progress: ProgressUpdate
  ): Promise<void> {
    if (onProgress) {
      try {
        await onProgress(progress);
      } catch (error) {
        console.warn('进度更新回调失败:', error);
      }
    }
  }
  
  /**
   * 流转临时文件
   */
  private static async streamToTempFile(
    stream: Readable, 
    docId: string
  ): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `parse_${docId}_${Date.now()}.tmp`);
    
    return new Promise((resolve, reject) => {
      const writeStream = require('fs').createWriteStream(tempFilePath);
      
      stream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        resolve(tempFilePath);
      });
      
      writeStream.on('error', (error: Error) => {
        reject(new ParseError(
          ParseErrorType.UNKNOWN_ERROR,
          `创建临时文件失败: ${error.message}`,
          error
        ));
      });
      
      stream.on('error', (error: Error) => {
        reject(new ParseError(
          ParseErrorType.FILE_CORRUPTED,
          `读取文件流失败: ${error.message}`,
          error
        ));
      });
    });
  }
  
  /**
   * 清理临时文件
   */
  private static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('清理临时文件失败:', error);
      // 不抛出错误
    }
  }
  
  /**
   * 生成章节ID
   */
  private static generateSectionId(): string {
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
  }
  
  /**
   * 映射章节类型（从内部到数据库）
   */
  private static mapToDbSectionType(type: any): string {
    // 简化映射，根据实际数据库字段调整
    return type || 'section';
  }
  
  /**
   * 映射章节类型（从数据库到内部）
   */
  private static mapSectionType(dbType: string): any {
    // 简化映射，根据实际需要调整
    return dbType;
  }
}