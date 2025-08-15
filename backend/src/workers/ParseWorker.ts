// src/workers/ParseWorker.ts - 文档解析Worker

import { BaseWorker } from './BaseWorker';
import { JobContext, JobResult, WorkerConfig } from '@/types/worker';
import { ParseService } from '@/services/ParseService';
import { ParseRequest, ParseConfig, ParseError, ParseErrorType } from '@/types/parse';
import { JobType } from '@/models/ProcessingJob';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 文档解析Worker
 * 
 * 职责：
 * - 处理文档解析作业
 * - 协调ParseService执行解析
 * - 管理解析进度和状态
 * - 处理解析错误和重试
 * - 创建后续的分块作业
 */
export class ParseWorker extends BaseWorker {
  constructor(config: WorkerConfig) {
    super(config);
    console.log(`📄 ParseWorker创建: ${config.name}`);
  }
  
  /**
   * 处理解析作业
   */
  protected async processJob(context: JobContext): Promise<JobResult> {
    const { job, startTime } = context;
    
    console.log(`📄 开始解析作业: ${job.job_id} (文档: ${job.doc_id})`);
    
    try {
      // 验证作业类型
      if (!this.isParseJob(job.job_type)) {
        throw new ParseError(
          ParseErrorType.UNSUPPORTED_FORMAT,
          `不支持的作业类型: ${job.job_type}`
        );
      }
      
      // 构建解析请求
      const parseRequest = await this.buildParseRequest(job);
      
      // 执行解析
      const parseResult = await ParseService.parseDocument(
        parseRequest,
        async (progress) => {
          // 检查是否被取消
          if (context.cancelled) {
            throw new Error('作业已被取消');
          }
          
          // 更新作业进度
          await this.updateProgress(job.job_id, {
            current: progress.current,
            total: progress.total,
            message: progress.message,
            details: progress.details
          });
        }
      );
      
      // 创建后续的分块作业
      await this.createChunkJob(job, parseResult);
      
      // 计算处理耗时
      const duration = Date.now() - startTime.getTime();
      
      // 构建成功结果
      const result: JobResult = {
        success: true,
        data: {
          docId: job.doc_id,
          parseResult: {
            sectionCount: parseResult.sections.length,
            totalChars: parseResult.stats.totalChars,
            pageCount: parseResult.stats.pageCount,
            language: parseResult.stats.detectedLanguage,
            qualityScore: parseResult.stats.qualityScore
          },
          nextJobs: [] // 分块作业信息
        },
        duration,
        memoryUsage: this.getCurrentMemoryUsage(),
        diskUsage: 0
      };
      
      console.log(`✅ 解析作业完成: ${job.job_id} (${parseResult.sections.length}个章节, 耗时: ${duration}ms)`);
      
      return result;
      
    } catch (error) {
      return this.handleParseError(error, job, startTime);
    }
  }
  
  /**
   * 检查是否为解析作业
   */
  private isParseJob(jobType: string): boolean {
    return [
      JobType.PARSE_PDF,
      JobType.PARSE_MARKDOWN,
      JobType.PARSE_TEXT
    ].includes(jobType as JobType);
  }
  
  /**
   * 构建解析请求
   */
  private async buildParseRequest(job: any): Promise<ParseRequest> {
    try {
      // 解析输入参数
      const inputParams = typeof job.input_params === 'string' 
        ? JSON.parse(job.input_params) 
        : job.input_params || {};
      
      // 解析作业配置
      const jobConfig = typeof job.job_config === 'string'
        ? JSON.parse(job.job_config)
        : job.job_config || {};
      
      // 构建解析配置
      const parseConfig: ParseConfig = {
        extractImages: inputParams.parseConfig?.extractImages || false,
        preserveFormatting: inputParams.parseConfig?.preserveFormatting || true,
        titleDetection: inputParams.parseConfig?.titleDetection || 'auto',
        maxSectionLength: inputParams.parseConfig?.maxSectionLength || 10000,
        cleanHeaderFooter: inputParams.parseConfig?.cleanHeaderFooter || true,
        languageHint: inputParams.parseConfig?.languageHint,
        qualityThreshold: inputParams.parseConfig?.qualityThreshold || 0.7,
        // 自定义标题模式
        titlePatterns: this.buildTitlePatterns(inputParams.parseConfig?.titlePatterns)
      };
      
      // 构建请求
      const request: ParseRequest = {
        docId: job.doc_id,
        userId: job.user_id,
        filePath: inputParams.filePath || job.file_path,
        bucket: inputParams.bucket || 'documents',
        mimeType: inputParams.mimeType,
        config: parseConfig,
        priority: job.priority || 5
      };
      
      // 验证请求参数
      this.validateParseRequest(request);
      
      return request;
      
    } catch (error) {
      throw new ParseError(
        ParseErrorType.PARSING_FAILED,
        `构建解析请求失败: ${getErrorMessage(error)}`,
        error
      );
    }
  }
  
  /**
   * 验证解析请求
   */
  private validateParseRequest(request: ParseRequest): void {
    const errors: string[] = [];
    
    if (!request.docId) {
      errors.push('缺少文档ID');
    }
    
    if (!request.userId) {
      errors.push('缺少用户ID');
    }
    
    if (!request.filePath) {
      errors.push('缺少文件路径');
    }
    
    if (!request.mimeType) {
      errors.push('缺少MIME类型');
    }
    
    if (errors.length > 0) {
      throw new ParseError(
        ParseErrorType.PARSING_FAILED,
        `解析请求验证失败: ${errors.join(', ')}`
      );
    }
  }
  
  /**
   * 构建标题模式
   */
  private buildTitlePatterns(patterns?: string[]): RegExp[] {
    const defaultPatterns = [
      /^第\s*[一二三四五六七八九十\d]+\s*[章节部分]/,  // 中文章节
      /^\d+(\.\d+)*\s+.{3,60}$/,                      // 数字标题
      /^[第]\s*\d+\s*[章节]/,                         // 第N章
      /^Chapter\s+\d+/i,                              // 英文章节
      /^Section\s+\d+/i,                              // 英文节
      /^[A-Z][A-Z\s]{2,50}$/                          // 全大写标题
    ];
    
    if (patterns && patterns.length > 0) {
      try {
        const customPatterns = patterns.map(pattern => new RegExp(pattern));
        return [...customPatterns, ...defaultPatterns];
      } catch (error) {
        console.warn('自定义标题模式无效，使用默认模式:', error);
      }
    }
    
    return defaultPatterns;
  }
  
  /**
   * 创建分块作业
   */
  private async createChunkJob(job: any, parseResult: any): Promise<void> {
    try {
      // 只有在解析成功且有章节时才创建分块作业
      if (parseResult.sections.length === 0) {
        console.warn(`⚠️ 文档无章节，跳过分块作业: ${job.doc_id}`);
        return;
      }
      
      const ProcessingJobModel = (await import('@/models/ProcessingJob')).default;
      const { JobType } = await import('@/models/ProcessingJob');
      
      // 准备分块作业的输入参数
      const chunkInputParams = {
        docId: job.doc_id,
        sectionCount: parseResult.sections.length,
        totalChars: parseResult.stats.totalChars,
        chunkConfig: {
          targetTokens: 400,
          maxTokens: 500,
          overlapTokens: 60,
          respectBoundaries: true
        }
      };
      
      // 创建分块作业
      const chunkJob = await ProcessingJobModel.create({
        doc_id: job.doc_id,
        user_id: job.user_id,
        job_type: JobType.CHUNK_DOCUMENT,
        priority: job.priority || 5,
        queue_name: 'chunk-processing',
        max_attempts: 3,
        retry_delay_seconds: 300,
        job_config: {
          timeout: 300000, // 5分钟
          dependsOn: job.job_id
        },
        input_params: chunkInputParams,
        file_path: ''
      });
      
      console.log(`📦 创建分块作业: ${chunkJob.job_id} (文档: ${job.doc_id})`);
      
    } catch (error) {
      console.error('创建分块作业失败:', error);
      // 不抛出错误，避免影响解析作业的成功
    }
  }
  
  /**
   * 处理解析错误
   */
  private handleParseError(
    error: any, 
    job: any, 
    startTime: Date
  ): JobResult {
    const duration = Date.now() - startTime.getTime();
    
    console.error(`❌ 解析作业失败: ${job.job_id}`, error);
    
    // 分类错误类型
    let errorType = 'unknown_error';
    let shouldRetry = true;
    
    if (error instanceof ParseError) {
      errorType = error.type;
      
      // 某些错误类型不应该重试
      switch (error.type) {
        case ParseErrorType.FILE_NOT_FOUND:
        case ParseErrorType.UNSUPPORTED_FORMAT:
        case ParseErrorType.FILE_CORRUPTED:
        case ParseErrorType.PERMISSION_DENIED:
          shouldRetry = false;
          break;
      }
    }
    
    return {
      success: false,
      error: getErrorMessage(error),
      errorStack: error instanceof Error ? error.stack ?? '' : '',
      duration,
      data: {
        errorType,
        shouldRetry,
        docId: job.doc_id,
        failureReason: this.getFailureReason(error)
      }
    };
  }
  
  /**
   * 获取失败原因描述
   */
  private getFailureReason(error: any): string {
    if (error instanceof ParseError) {
      switch (error.type) {
        case ParseErrorType.FILE_NOT_FOUND:
          return '文件不存在或无法访问';
        case ParseErrorType.FILE_CORRUPTED:
          return '文件已损坏或格式错误';
        case ParseErrorType.UNSUPPORTED_FORMAT:
          return '不支持的文件格式';
        case ParseErrorType.TIMEOUT:
          return '解析超时';
        case ParseErrorType.MEMORY_LIMIT:
          return '内存不足';
        case ParseErrorType.PERMISSION_DENIED:
          return '权限不足';
        default:
          return '未知解析错误';
      }
    }
    
    return '系统错误';
  }
  
  /**
   * 获取当前内存使用量
   */
  private getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed;
  }
}