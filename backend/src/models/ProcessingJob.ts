// src/models/ProcessingJob.ts

import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/utils/database';
import { BaseEntity } from '@/types/base';

/**
 * 作业类型枚举
 */
export enum JobType {
  PARSE_PDF = 'parse_pdf',           // PDF解析作业
  PARSE_MARKDOWN = 'parse_markdown', // Markdown解析作业
  PARSE_TEXT = 'parse_text',         // 纯文本解析作业
  CHUNK_DOCUMENT = 'chunk_document', // 文档分块作业
  EMBED_CHUNKS = 'embed_chunks',     // 块向量化作业(Milestone 2)
  CLEANUP_TEMP = 'cleanup_temp'      // 临时文件清理作业
}

/**
 * 作业状态枚举
 */
export enum JobStatus {
  QUEUED = 'queued',         // 已入队，等待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 已完成
  FAILED = 'failed',         // 失败
  CANCELLED = 'cancelled',   // 已取消
  RETRY = 'retry'           // 等待重试
}

/**
 * 作业配置接口
 */
export interface JobConfig {
  timeout?: number;
  retryDelay?: number;
  priority?: number;
  [key: string]: any;
}

/**
 * 作业输入参数接口
 */
export interface JobInputParams {
  filePath?: string;
  options?: Record<string, any>;
  [key: string]: any;
}

/**
 * 进度详情接口
 */
export interface ProgressDetails {
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  estimatedTimeRemaining?: number;
  throughput?: number;
  [key: string]: any;
}

/**
 * 作业结果数据接口
 */
export interface JobResultData {
  success: boolean;
  outputFiles?: string[];
  statistics?: Record<string, any>;
  extractedData?: any;
  [key: string]: any;
}

/**
 * 性能指标接口
 */
export interface JobMetrics {
  cpuUsage?: number;
  memoryPeak?: number;
  diskIO?: number;
  networkIO?: number;
  cacheHits?: number;
  cacheMisses?: number;
  [key: string]: any;
}

/**
 * 调试信息接口
 */
export interface DebugInfo {
  stackTrace?: string;
  environment?: Record<string, any>;
  configuration?: Record<string, any>;
  [key: string]: any;
}

/**
 * 作业触发配置接口
 */
export interface JobTrigger {
  jobType: JobType;
  condition: 'on_success' | 'on_failure' | 'always';
  delay?: number;
  config?: JobConfig;
  inputParams?: JobInputParams;
}

/**
 * 处理作业基础接口
 */
export interface ProcessingJob extends BaseEntity {
  job_id: string;
  doc_id: string;
  user_id: string;
  
  // 作业基本信息
  job_type: JobType;
  status: JobStatus;
  priority: number;
  queue_name: string;
  worker_id?: string;
  
  // 重试机制
  attempts: number;
  max_attempts: number;
  next_retry_at?: Date;
  retry_delay_seconds: number;
  
  // 作业配置和输入参数
  job_config?: JobConfig;
  input_params?: JobInputParams;
  file_path?: string;
  
  // 进度跟踪
  progress_current: number;
  progress_total: number;
  progress_percentage: number;
  progress_message?: string;
  progress_details?: ProgressDetails;
  
  // 时间记录
  queued_at: Date;
  started_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  
  // 性能统计
  processing_duration_ms?: number;
  queue_wait_duration_ms?: number;
  memory_usage_bytes?: number;
  disk_usage_bytes?: number;
  
  // 结果和错误信息
  result_data?: JobResultData;
  error_message?: string;
  error_stack?: string;
  error_code?: string;
  
  // 日志和调试信息
  execution_log?: string;
  debug_info?: DebugInfo;
  metrics?: JobMetrics;
  
  // 依赖关系
  depends_on?: string[];
  triggers?: JobTrigger[];
}

/**
 * 创建作业请求接口
 */
export interface CreateJobRequest {
  doc_id: string;
  user_id: string;
  job_type: JobType;
  priority?: number;
  queue_name?: string;
  max_attempts?: number;
  retry_delay_seconds?: number;
  job_config?: JobConfig;
  input_params?: JobInputParams;
  file_path?: string;
  depends_on?: string[];
  triggers?: JobTrigger[];
}

/**
 * 更新作业请求接口
 */
export interface UpdateJobRequest {
  status?: JobStatus;
  worker_id?: string;
  progress_current?: number;
  progress_total?: number;
  progress_message?: string;
  progress_details?: ProgressDetails;
  started_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  processing_duration_ms?: number;
  queue_wait_duration_ms?: number;
  memory_usage_bytes?: number;
  disk_usage_bytes?: number;
  result_data?: JobResultData;
  error_message?: string;
  error_stack?: string;
  error_code?: string;
  execution_log?: string;
  debug_info?: DebugInfo;
  metrics?: JobMetrics;
}

/**
 * 作业查询选项接口
 */
export interface JobQueryOptions {
  includeDeleted?: boolean;
  docId?: string;
  userId?: string;
  jobType?: JobType;
  status?: JobStatus;
  queueName?: string;
  workerId?: string;
  priority?: number;
  sortBy?: 'created_at' | 'priority' | 'queued_at' | 'started_at';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 作业统计信息接口
 */
export interface JobStats {
  total: number;
  byStatus: Record<JobStatus, number>;
  byType: Record<JobType, number>;
  avgProcessingTime: number;
  avgQueueTime: number;
  successRate: number;
}

/**
 * 处理作业模型类
 * 提供作业相关的数据库操作方法
 */
export class ProcessingJobModel {
  private static readonly TABLE_NAME = 'processing_jobs';

  /**
   * 创建新作业
   * @param jobData 作业数据
   * @param trx 可选的数据库事务
   * @returns 创建的作业信息
   */
  public static async create(
    jobData: CreateJobRequest,
    trx?: Knex.Transaction
  ): Promise<ProcessingJob> {
    const dbInstance = trx || db;

    try {
      // 生成作业ID
      const jobId = uuidv4();
      
      // 准备作业记录
      const jobRecord = {
        job_id: jobId,
        doc_id: jobData.doc_id,
        user_id: jobData.user_id,
        job_type: jobData.job_type,
        status: JobStatus.QUEUED,
        priority: jobData.priority || 5,
        queue_name: jobData.queue_name || 'default',
        worker_id: null,
        attempts: 0,
        max_attempts: jobData.max_attempts || 3,
        next_retry_at: null,
        retry_delay_seconds: jobData.retry_delay_seconds || 60,
        job_config: jobData.job_config ? JSON.stringify(jobData.job_config) : null,
        input_params: jobData.input_params ? JSON.stringify(jobData.input_params) : null,
        file_path: jobData.file_path || null,
        progress_current: 0,
        progress_total: 100,
        progress_percentage: 0.00,
        progress_message: null,
        progress_details: null,
        queued_at: new Date(),
        started_at: null,
        completed_at: null,
        failed_at: null,
        processing_duration_ms: null,
        queue_wait_duration_ms: null,
        memory_usage_bytes: null,
        disk_usage_bytes: null,
        result_data: null,
        error_message: null,
        error_stack: null,
        error_code: null,
        execution_log: null,
        debug_info: null,
        metrics: null,
        depends_on: jobData.depends_on ? JSON.stringify(jobData.depends_on) : null,
        triggers: jobData.triggers ? JSON.stringify(jobData.triggers) : null,
        created_at: new Date(),
        updated_at: new Date()
      };

      // 插入作业记录
      await dbInstance(this.TABLE_NAME).insert(jobRecord);

      // 返回创建的作业信息
      const createdJob = await this.findById(jobId);
      if (!createdJob) {
        throw new Error('作业创建失败');
      }

      return createdJob;
    } catch (error) {
      console.error('作业创建失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找作业
   * @param jobId 作业ID
   * @param options 查询选项
   * @returns 作业信息
   */
  public static async findById(
    jobId: string,
    options: JobQueryOptions = {}
  ): Promise<ProcessingJob | null> {
    try {
      let query = db(this.TABLE_NAME)
        .where('job_id', jobId);

      query = this.applyQueryOptions(query, options);

      const job = await query.first();
      if (!job) return null;

      return this.formatJob(job);
    } catch (error) {
      console.error('查找作业失败:', error);
      throw error;
    }
  }

  /**
   * 根据文档ID获取作业列表
   * @param docId 文档ID
   * @param options 查询选项
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 作业列表
   */
  public static async findByDocument(
    docId: string,
    options: JobQueryOptions = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<ProcessingJob[]> {
    try {
      let query = db(this.TABLE_NAME)
        .where('doc_id', docId);

      query = this.applyQueryOptions(query, options);
      
      // 默认按创建时间倒序排序
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      query = query.orderBy(sortBy, sortOrder);

      // 分页
      query = query.limit(limit).offset(offset);

      const jobs = await query;
      return jobs.map(job => this.formatJob(job));
    } catch (error) {
      console.error('查找文档作业失败:', error);
      throw error;
    }
  }

  /**
   * 获取队列中的作业
   * @param queueName 队列名称
   * @param status 作业状态
   * @param limit 限制数量
   * @returns 作业列表
   */
  public static async findByQueue(
    queueName: string,
    status?: JobStatus,
    limit: number = 100
  ): Promise<ProcessingJob[]> {
    try {
      let query = db(this.TABLE_NAME)
        .where('queue_name', queueName);

      if (status) {
        query = query.where('status', status);
      }

      // 按优先级和创建时间排序
      query = query
        .orderBy('priority', 'asc')
        .orderBy('queued_at', 'asc')
        .limit(limit);

      const jobs = await query;
      return jobs.map(job => this.formatJob(job));
    } catch (error) {
      console.error('查找队列作业失败:', error);
      throw error;
    }
  }

  /**
   * 获取待重试的作业
   * @param limit 限制数量
   * @returns 待重试的作业列表
   */
  public static async findRetryableJobs(limit: number = 50): Promise<ProcessingJob[]> {
    try {
      const query = db(this.TABLE_NAME)
        .where('status', JobStatus.RETRY)
        .where(function(this: Knex.QueryBuilder) {
          this.whereNull('next_retry_at')
            .orWhere('next_retry_at', '<=', new Date());
        })
        .orderBy('priority', 'asc')
        .orderBy('next_retry_at', 'asc')
        .limit(limit);

      const jobs = await query;
      return jobs.map(job => this.formatJob(job));
    } catch (error) {
      console.error('查找可重试作业失败:', error);
      throw error;
    }
  }

  /**
   * 更新作业信息
   * @param jobId 作业ID
   * @param updates 更新数据
   * @param trx 可选的数据库事务
   * @returns 更新后的作业信息
   */
  public static async update(
    jobId: string,
    updates: UpdateJobRequest,
    trx?: Knex.Transaction
  ): Promise<ProcessingJob | null> {
    const dbInstance = trx || db;

    try {
      // 检查作业是否存在
      const existingJob = await this.findById(jobId);
      if (!existingJob) {
        throw new Error('作业不存在');
      }

      // 准备更新数据
      const updateData: any = {
        ...updates,
        updated_at: new Date()
      };

      // 计算进度百分比
      if (updates.progress_current !== undefined || updates.progress_total !== undefined) {
        const current = updates.progress_current ?? existingJob.progress_current;
        const total = updates.progress_total ?? existingJob.progress_total;
        updateData.progress_percentage = total > 0 ? Number(((current / total) * 100).toFixed(2)) : 0;
      }

      // 处理JSON字段
      if (updates.progress_details !== undefined) {
        updateData.progress_details = updates.progress_details ? JSON.stringify(updates.progress_details) : null;
      }
      if (updates.result_data !== undefined) {
        updateData.result_data = updates.result_data ? JSON.stringify(updates.result_data) : null;
      }
      if (updates.debug_info !== undefined) {
        updateData.debug_info = updates.debug_info ? JSON.stringify(updates.debug_info) : null;
      }
      if (updates.metrics !== undefined) {
        updateData.metrics = updates.metrics ? JSON.stringify(updates.metrics) : null;
      }

      // 清理undefined值
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // 执行更新
      await dbInstance(this.TABLE_NAME)
        .where('job_id', jobId)
        .update(updateData);

      // 返回更新后的作业信息
      return await this.findById(jobId);
    } catch (error) {
      console.error('更新作业失败:', error);
      throw error;
    }
  }

  /**
   * 开始处理作业
   * @param jobId 作业ID
   * @param workerId 工作器ID
   * @param trx 可选的数据库事务
   * @returns 是否更新成功
   */
  public static async startProcessing(
    jobId: string,
    workerId: string,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const now = new Date();
      const result = await dbInstance(this.TABLE_NAME)
        .where('job_id', jobId)
        .where('status', JobStatus.QUEUED)
        .update({
          status: JobStatus.PROCESSING,
          worker_id: workerId,
          started_at: now,
          attempts: db.raw('attempts + 1'),
          updated_at: now
        });

      return result > 0;
    } catch (error) {
      console.error('开始处理作业失败:', error);
      throw error;
    }
  }

  /**
   * 完成作业
   * @param jobId 作业ID
   * @param resultData 结果数据
   * @param trx 可选的数据库事务
   * @returns 是否更新成功
   */
  public static async completeJob(
    jobId: string,
    resultData?: JobResultData,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const now = new Date();
      const job = await this.findById(jobId);
      if (!job) return false;

      const processingDuration = job.started_at ? now.getTime() - job.started_at.getTime() : null;
      const queueWaitDuration = now.getTime() - job.queued_at.getTime();

      const result = await dbInstance(this.TABLE_NAME)
        .where('job_id', jobId)
        .update({
          status: JobStatus.COMPLETED,
          completed_at: now,
          progress_current: job.progress_total,
          progress_percentage: 100,
          processing_duration_ms: processingDuration,
          queue_wait_duration_ms: queueWaitDuration,
          result_data: resultData ? JSON.stringify(resultData) : null,
          updated_at: now
        });

      return result > 0;
    } catch (error) {
      console.error('完成作业失败:', error);
      throw error;
    }
  }

  /**
   * 作业失败
   * @param jobId 作业ID
   * @param errorMessage 错误消息
   * @param errorStack 错误堆栈
   * @param errorCode 错误代码
   * @param trx 可选的数据库事务
   * @returns 是否更新成功
   */
  public static async failJob(
    jobId: string,
    errorMessage: string,
    errorStack?: string,
    errorCode?: string,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const now = new Date();
      const job = await this.findById(jobId);
      if (!job) return false;

      const updateData: any = {
        failed_at: now,
        error_message: errorMessage,
        error_stack: errorStack || null,
        error_code: errorCode || null,
        updated_at: now
      };

      // 检查是否需要重试
      if (job.attempts < job.max_attempts) {
        updateData.status = JobStatus.RETRY;
        updateData.next_retry_at = new Date(now.getTime() + (job.retry_delay_seconds * 1000));
      } else {
        updateData.status = JobStatus.FAILED;
      }

      const result = await dbInstance(this.TABLE_NAME)
        .where('job_id', jobId)
        .update(updateData);

      return result > 0;
    } catch (error) {
      console.error('作业失败处理失败:', error);
      throw error;
    }
  }

  /**
   * 取消作业
   * @param jobId 作业ID
   * @param trx 可选的数据库事务
   * @returns 是否取消成功
   */
  public static async cancelJob(jobId: string, trx?: Knex.Transaction): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const result = await dbInstance(this.TABLE_NAME)
        .where('job_id', jobId)
        .whereIn('status', [JobStatus.QUEUED, JobStatus.RETRY])
        .update({
          status: JobStatus.CANCELLED,
          updated_at: new Date()
        });

      return result > 0;
    } catch (error) {
      console.error('取消作业失败:', error);
      throw error;
    }
  }

  /**
   * 获取作业统计信息
   * @param userId 用户ID（可选）
   * @param docId 文档ID（可选）
   * @returns 统计信息
   */
  public static async getStats(userId?: string, docId?: string): Promise<JobStats> {
    try {
      let query = db(this.TABLE_NAME);

      if (userId) {
        query = query.where('user_id', userId);
      }
      if (docId) {
        query = query.where('doc_id', docId);
      }

      // 基础统计
      const [totalResult] = await query.clone()
        .count('job_id as total')
        .avg('processing_duration_ms as avgProcessingTime')
        .avg('queue_wait_duration_ms as avgQueueTime');

      // 按状态统计
      const statusStats = await query.clone()
        .select('status')
        .count('job_id as count')
        .groupBy('status');

      // 按类型统计
      const typeStats = await query.clone()
        .select('job_type')
        .count('job_id as count')
        .groupBy('job_type');

      // 成功率统计
      const [successResult] = await query.clone()
        .count('job_id as total')
        .sum(db.raw('CASE WHEN status = ? THEN 1 ELSE 0 END as successful', [JobStatus.COMPLETED]));

      // 格式化结果
      const byStatus: Record<JobStatus, number> = {} as any;
      Object.values(JobStatus).forEach(status => {
        byStatus[status] = 0;
      });
      statusStats.forEach(stat => {
        byStatus[stat.status as JobStatus] = Number(stat.count);
      });

      const byType: Record<JobType, number> = {} as any;
      Object.values(JobType).forEach(type => {
        byType[type] = 0;
      });
      typeStats.forEach(stat => {
        byType[stat.job_type as JobType] = Number(stat.count);
      });

      const total = totalResult && totalResult.total !== undefined ? Number(totalResult.total) : 0;
      const successful = successResult && successResult.successful !== undefined ? Number(successResult.successful) : 0;
      const successRate = total > 0 ? Number(((successful / total) * 100).toFixed(2)) : 0;

      return {
        total,
        byStatus,
        byType,
        avgProcessingTime: totalResult && totalResult.avgProcessingTime !== undefined ? Number(totalResult.avgProcessingTime) : 0,
        avgQueueTime: totalResult && totalResult.avgQueueTime !== undefined ? Number(totalResult.avgQueueTime) : 0,
        successRate
      };
    } catch (error) {
      console.error('获取作业统计失败:', error);
      throw error;
    }
  }

  /**
   * 清理旧作业记录
   * @param daysOld 清理多少天前的记录
   * @param keepSuccessful 是否保留成功的作业
   * @param trx 可选的数据库事务
   * @returns 清理的记录数
   */
  public static async cleanupOldJobs(
    daysOld: number = 30,
    keepSuccessful: boolean = true,
    trx?: Knex.Transaction
  ): Promise<number> {
    const dbInstance = trx || db;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let query = dbInstance(this.TABLE_NAME)
        .where('created_at', '<', cutoffDate);

      if (keepSuccessful) {
        query = query.whereNot('status', JobStatus.COMPLETED);
      }

      const result = await query.del();
      return result;
    } catch (error) {
      console.error('清理旧作业失败:', error);
      throw error;
    }
  }

  /**
   * 应用查询选项
   * @param query 查询构建器
   * @param options 查询选项
   * @returns 修改后的查询构建器
   */
  private static applyQueryOptions(
    query: Knex.QueryBuilder,
    options: JobQueryOptions
  ): Knex.QueryBuilder {
    // 按文档ID过滤
    if (options.docId) {
      query = query.where('doc_id', options.docId);
    }

    // 按用户ID过滤
    if (options.userId) {
      query = query.where('user_id', options.userId);
    }

    // 按作业类型过滤
    if (options.jobType) {
      query = query.where('job_type', options.jobType);
    }

    // 按状态过滤
    if (options.status) {
      query = query.where('status', options.status);
    }

    // 按队列名称过滤
    if (options.queueName) {
      query = query.where('queue_name', options.queueName);
    }

    // 按工作器ID过滤
    if (options.workerId) {
      query = query.where('worker_id', options.workerId);
    }

    // 按优先级过滤
    if (options.priority !== undefined) {
      query = query.where('priority', options.priority);
    }

    return query;
  }

  /**
   * 格式化作业对象
   * @param job 原始作业数据
   * @returns 格式化后的作业对象
   */
  private static formatJob(job: any): ProcessingJob {
    return {
      ...job,
      // 解析JSON字段
      job_config: job.job_config ? JSON.parse(job.job_config) : undefined,
      input_params: job.input_params ? JSON.parse(job.input_params) : undefined,
      progress_details: job.progress_details ? JSON.parse(job.progress_details) : undefined,
      result_data: job.result_data ? JSON.parse(job.result_data) : undefined,
      debug_info: job.debug_info ? JSON.parse(job.debug_info) : undefined,
      metrics: job.metrics ? JSON.parse(job.metrics) : undefined,
      depends_on: job.depends_on ? JSON.parse(job.depends_on) : undefined,
      triggers: job.triggers ? JSON.parse(job.triggers) : undefined,
      // 确保数字类型
      priority: Number(job.priority),
      attempts: Number(job.attempts),
      max_attempts: Number(job.max_attempts),
      retry_delay_seconds: Number(job.retry_delay_seconds),
      progress_current: Number(job.progress_current),
      progress_total: Number(job.progress_total),
      progress_percentage: Number(job.progress_percentage),
      processing_duration_ms: job.processing_duration_ms ? Number(job.processing_duration_ms) : undefined,
      queue_wait_duration_ms: job.queue_wait_duration_ms ? Number(job.queue_wait_duration_ms) : undefined,
      memory_usage_bytes: job.memory_usage_bytes ? Number(job.memory_usage_bytes) : undefined,
      disk_usage_bytes: job.disk_usage_bytes ? Number(job.disk_usage_bytes) : undefined
    };
  }
}

// 导出作业模型类
export default ProcessingJobModel;