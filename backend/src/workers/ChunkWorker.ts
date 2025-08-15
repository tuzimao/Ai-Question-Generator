// src/workers/ChunkWorker.ts - 文档分块Worker

import { BaseWorker } from './BaseWorker';
import { JobContext, JobResult, WorkerConfig } from '@/types/worker';
import { ChunkService, ChunkRequest } from '@/services/ChunkService';
import ChunkingConfig from '@/services/ChunkService';
import { JobType } from '@/models/ProcessingJob';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 文档分块Worker
 * 
 * 职责：
 * - 处理文档分块作业
 * - 协调ChunkService执行分块
 * - 管理分块进度和状态
 * - 处理分块错误和重试
 * - 为后续的向量化作业做准备
 */
export class ChunkWorker extends BaseWorker {
  constructor(config: WorkerConfig) {
    super(config);
    console.log(`🔪 ChunkWorker创建: ${config.name}`);
  }

  /**
   * 处理分块作业
   */
  protected async processJob(context: JobContext): Promise<JobResult> {
    const { job, startTime } = context;
    
    console.log(`🔪 开始分块作业: ${job.job_id} (文档: ${job.doc_id})`);
    
    try {
      // 验证作业类型
      if (job.job_type !== JobType.CHUNK_DOCUMENT) {
        throw new Error(`不支持的作业类型: ${job.job_type}`);
      }

      // 构建分块请求
      const chunkRequest = this.buildChunkRequest(job);

      // 执行分块
      const chunkResult = await ChunkService.chunkDocument({
        ...chunkRequest,
        onProgress: async (progress) => {
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
      });

      // 计算处理耗时
      const duration = Date.now() - startTime.getTime();

      // 构建成功结果
      const result: JobResult = {
        success: true,
        data: {
          docId: job.doc_id,
          chunkResult: {
            chunksCreated: chunkResult.chunksCreated,
            sectionsProcessed: chunkResult.sectionsProcessed,
            totalTokens: chunkResult.totalTokens,
            stats: chunkResult.stats
          },
          readyForEmbedding: true,
          nextStep: 'embedding'
        },
        duration,
        memoryUsage: this.getCurrentMemoryUsage()
      };

      console.log(`✅ 分块作业完成: ${job.job_id} (${chunkResult.chunksCreated}个块, 耗时: ${duration}ms)`);

      return result;

    } catch (error) {
      return this.handleChunkError(error, job, startTime);
    }
  }

  /**
   * 构建分块请求
   */
  private buildChunkRequest(job: any): ChunkRequest {
    try {
      // 解析输入参数
      const inputParams = typeof job.input_params === 'string'
        ? JSON.parse(job.input_params)
        : job.input_params || {};

      // 解析作业配置
      const jobConfig = typeof job.job_config === 'string'
        ? JSON.parse(job.job_config)
        : job.job_config || {};

      // 构建分块配置
      const chunkConfig: ChunkingConfig = {
        strategy: inputParams.chunkConfig?.strategy || 'hybrid',
        targetTokens: inputParams.chunkConfig?.targetTokens || 400,
        maxTokens: inputParams.chunkConfig?.maxTokens || 500,
        overlapTokens: inputParams.chunkConfig?.overlapTokens || 60,
        respectBoundaries: inputParams.chunkConfig?.respectBoundaries !== false,
        minChunkSize: inputParams.chunkConfig?.minChunkSize || 50
      };

      // 构建请求
      const request: ChunkRequest = {
        docId: job.doc_id,
        userId: job.user_id,
        config: chunkConfig
      };

      // 验证请求参数
      this.validateChunkRequest(request);

      return request;

    } catch (error) {
      throw new Error(`构建分块请求失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 验证分块请求
   */
  private validateChunkRequest(request: ChunkRequest): void {
    const errors: string[] = [];

    if (!request.docId) {
      errors.push('缺少文档ID');
    }

    if (!request.userId) {
      errors.push('缺少用户ID');
    }

    if (request.config.targetTokens <= 0) {
      errors.push('目标Token数必须大于0');
    }

    if (request.config.maxTokens < request.config.targetTokens) {
      errors.push('最大Token数不能小于目标Token数');
    }

    if (request.config.overlapTokens < 0) {
      errors.push('重叠Token数不能为负数');
    }

    if (request.config.overlapTokens >= request.config.targetTokens) {
      errors.push('重叠Token数不能大于等于目标Token数');
    }

    if (errors.length > 0) {
      throw new Error(`分块请求验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 处理分块错误
   */
  private handleChunkError(
    error: any,
    job: any,
    startTime: Date
  ): JobResult {
    const duration = Date.now() - startTime.getTime();
    
    console.error(`❌ 分块作业失败: ${job.job_id}`, error);

    // 判断是否应该重试
    const shouldRetry = this.shouldRetryError(error);

    return {
      success: false,
      error: getErrorMessage(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      duration,
      data: {
        docId: job.doc_id,
        shouldRetry,
        failureReason: this.getFailureReason(error)
      }
    };
  }

  /**
   * 判断错误是否应该重试
   */
  private shouldRetryError(error: any): boolean {
    const errorMessage = getErrorMessage(error).toLowerCase();

    // 不应该重试的错误
    const noRetryErrors = [
      '文档不存在',
      '无权限',
      '文档没有章节数据',
      '验证失败'
    ];

    return !noRetryErrors.some(msg => errorMessage.includes(msg));
  }

  /**
   * 获取失败原因
   */
  private getFailureReason(error: any): string {
    const errorMessage = getErrorMessage(error).toLowerCase();

    if (errorMessage.includes('文档不存在')) {
      return '文档不存在';
    }
    
    if (errorMessage.includes('无权限')) {
      return '权限不足';
    }
    
    if (errorMessage.includes('没有章节')) {
      return '文档没有章节数据';
    }
    
    if (errorMessage.includes('内存')) {
      return '内存不足';
    }
    
    if (errorMessage.includes('超时')) {
      return '处理超时';
    }

    return '未知错误';
  }

  /**
   * 获取当前内存使用量
   */
  private getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed;
  }
}

export default ChunkWorker;