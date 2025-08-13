// src/workers/EmbeddingWorker.ts - 向量化Worker

import { BaseWorker } from './BaseWorker';
import { JobContext, JobResult, WorkerConfig } from '@/types/worker';
import { EmbeddingService } from '@/services/EmbeddingService';
import { 
  EmbeddingRequest,
  EmbeddingConfig,
  EmbeddingProviderType,
  VectorStoreType
} from '@/types/embedding';
import { JobType } from '@/models/ProcessingJob';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 向量化Worker
 * 
 * 职责：
 * - 处理向量化作业
 * - 协调EmbeddingService执行向量化
 * - 管理向量化进度和状态
 * - 处理错误和重试
 */
export class EmbeddingWorker extends BaseWorker {
  constructor(config: WorkerConfig) {
    super(config);
    console.log(`🎯 EmbeddingWorker创建: ${config.name}`);
  }

  /**
   * 处理向量化作业
   */
  protected async processJob(context: JobContext): Promise<JobResult> {
    const { job, startTime } = context;
    
    console.log(`🎯 开始向量化作业: ${job.job_id} (文档: ${job.doc_id})`);
    
    try {
      // 验证作业类型
      if (job.job_type !== JobType.EMBED_CHUNKS) {
        throw new Error(`不支持的作业类型: ${job.job_type}`);
      }

      // 构建向量化请求
      const embeddingRequest = this.buildEmbeddingRequest(job);

      // 执行向量化
      const embeddingResult = await EmbeddingService.embedDocument({
        ...embeddingRequest,
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
          embeddingResult: {
            chunksProcessed: embeddingResult.chunksProcessed,
            chunksFailed: embeddingResult.chunksFailed,
            totalTokens: embeddingResult.totalTokens,
            totalCost: embeddingResult.totalCost,
            provider: embeddingResult.provider,
            model: embeddingResult.model,
            vectorStore: embeddingResult.vectorStoreType
          },
          documentReady: true
        },
        duration,
        memoryUsage: this.getCurrentMemoryUsage()
      };

      console.log(`✅ 向量化作业完成: ${job.job_id} (${embeddingResult.chunksProcessed}个块, 成本: $${embeddingResult.totalCost?.toFixed(4)}, 耗时: ${duration}ms)`);

      return result;

    } catch (error) {
      return this.handleEmbeddingError(error, job, startTime);
    }
  }

  /**
   * 构建向量化请求
   */
  private buildEmbeddingRequest(job: any): EmbeddingRequest {
    try {
      // 解析输入参数
      const inputParams = typeof job.input_params === 'string'
        ? JSON.parse(job.input_params)
        : job.input_params || {};

      // 解析作业配置
      const jobConfig = typeof job.job_config === 'string'
        ? JSON.parse(job.job_config)
        : job.job_config || {};

      // 确定Provider和VectorStore
      const provider = this.getProvider(inputParams, jobConfig);
      const vectorStore = this.getVectorStore(inputParams, jobConfig);

      // 构建向量化配置
      const embeddingConfig: EmbeddingConfig = {
        provider,
        model: this.getModel(provider, inputParams),
        dimension: this.getDimension(provider, inputParams),
        batchSize: inputParams.batchSize || 50,
        maxConcurrent: inputParams.maxConcurrent || 3,
        retryOnFailure: inputParams.retryOnFailure !== false,
        costLimit: inputParams.costLimit,
        requestInterval: inputParams.requestInterval || 200
      };

      // 构建请求
      const request: EmbeddingRequest = {
        docId: job.doc_id,
        userId: job.user_id,
        config: embeddingConfig,
        vectorStore
      };

      // 验证请求参数
      this.validateEmbeddingRequest(request);

      return request;

    } catch (error) {
      throw new Error(`构建向量化请求失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 获取Provider类型
   */
  private getProvider(inputParams: any, jobConfig: any): EmbeddingProviderType {
    // 优先使用输入参数，然后是作业配置，最后是环境变量
    const provider = inputParams.provider || 
                    jobConfig.provider || 
                    process.env.EMBEDDING_PROVIDER ||
                    'openai';

    // 验证Provider类型
    if (!Object.values(EmbeddingProviderType).includes(provider)) {
      console.warn(`未知的Provider: ${provider}, 使用默认值: openai`);
      return EmbeddingProviderType.OPENAI;
    }

    return provider as EmbeddingProviderType;
  }

  /**
   * 获取VectorStore类型
   */
  private getVectorStore(inputParams: any, jobConfig: any): VectorStoreType {
    // 优先使用输入参数，然后是作业配置，最后是环境变量
    const store = inputParams.vectorStore || 
                 jobConfig.vectorStore || 
                 process.env.VECTOR_STORE ||
                 'memory';

    // 验证VectorStore类型
    if (!Object.values(VectorStoreType).includes(store)) {
      console.warn(`未知的VectorStore: ${store}, 使用默认值: memory`);
      return VectorStoreType.MEMORY;
    }

    return store as VectorStoreType;
  }

  /**
   * 获取模型名称
   */
  private getModel(provider: EmbeddingProviderType, inputParams: any): string {
    if (inputParams.model) {
      return inputParams.model;
    }

    // 根据Provider设置默认模型
    switch (provider) {
      case EmbeddingProviderType.OPENAI:
        return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      case EmbeddingProviderType.LOCAL:
        return 'local-model';
      default:
        return 'unknown';
    }
  }

  /**
   * 获取向量维度
   */
  private getDimension(provider: EmbeddingProviderType, inputParams: any): number {
    if (inputParams.dimension) {
      return inputParams.dimension;
    }

    // 根据Provider设置默认维度
    switch (provider) {
      case EmbeddingProviderType.OPENAI:
        return 1536; // text-embedding-3-small
      case EmbeddingProviderType.LOCAL:
        return 384;
      default:
        return 1536;
    }
  }

  /**
   * 验证向量化请求
   */
  private validateEmbeddingRequest(request: EmbeddingRequest): void {
    const errors: string[] = [];

    if (!request.docId) {
      errors.push('缺少文档ID');
    }

    if (!request.userId) {
      errors.push('缺少用户ID');
    }

    if (request.config.batchSize <= 0) {
      errors.push('批次大小必须大于0');
    }

    if (request.config.dimension <= 0) {
      errors.push('向量维度必须大于0');
    }

    if (errors.length > 0) {
      throw new Error(`向量化请求验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 处理向量化错误
   */
  private handleEmbeddingError(
    error: any,
    job: any,
    startTime: Date
  ): JobResult {
    const duration = Date.now() - startTime.getTime();
    
    console.error(`❌ 向量化作业失败: ${job.job_id}`, error);

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

    // 应该重试的错误
    const retryableErrors = [
      'rate limit',
      'timeout',
      'network',
      'temporary'
    ];

    // 不应该重试的错误
    const noRetryErrors = [
      '文档不存在',
      '无权限',
      'api密钥无效',
      '成本超限'
    ];

    // 检查是否是不应该重试的错误
    if (noRetryErrors.some(msg => errorMessage.includes(msg))) {
      return false;
    }

    // 检查是否是应该重试的错误
    return retryableErrors.some(msg => errorMessage.includes(msg));
  }

  /**
   * 获取失败原因
   */
  private getFailureReason(error: any): string {
    const errorMessage = getErrorMessage(error).toLowerCase();

    if (errorMessage.includes('rate limit')) {
      return 'API速率限制';
    }
    
    if (errorMessage.includes('api')) {
      return 'API调用失败';
    }
    
    if (errorMessage.includes('成本')) {
      return '成本超限';
    }
    
    if (errorMessage.includes('timeout')) {
      return '处理超时';
    }
    
    if (errorMessage.includes('memory')) {
      return '内存不足';
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

export default EmbeddingWorker;