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
      max_attempts: jobData.max_attempts || 3,
      retry_delay_seconds: jobData.retry_delay_seconds || 60,
      attempts: 0,
      progress_current: 0,
      progress_total: 100,
      progress_percentage: 0.00,
      queued_at: new Date(),
      // 🔧 修复：安全处理JSON字段
      job_config: this.prepareJSONField(jobData.job_config),
      input_params: this.prepareJSONField(jobData.input_params),
      file_path: jobData.file_path || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('🔧 准备插入的作业记录:', {
      job_id: jobRecord.job_id,
      job_type: jobRecord.job_type,
      doc_id: jobRecord.doc_id
    });

    // 插入作业记录
    const insertResult = await dbInstance(this.TABLE_NAME).insert(jobRecord);
    console.log('🔧 作业插入结果:', insertResult);

    // 🔧 修复：使用同一个事务来查询刚创建的作业
    console.log('🔧 验证作业是否创建成功...');
    const createdJob = await this.findByIdWithTransaction(jobId, dbInstance);
    if (!createdJob) {
      console.error('🔧 验证失败：无法找到刚创建的作业');
      throw new Error('作业创建失败');
    }

    console.log('🔧 作业创建验证成功:', createdJob.job_id);
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
  const safeParseJSON = (value: any) => {
    if (!value) return undefined;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return undefined; }
    }
    return undefined;
  };

  return {
    ...job,
    job_config: safeParseJSON(job.job_config),
    input_params: safeParseJSON(job.input_params),
    result_data: safeParseJSON(job.result_data),
    progress_details: safeParseJSON(job.progress_details),
    debug_info: safeParseJSON(job.debug_info),
    metrics: safeParseJSON(job.metrics),
    depends_on: safeParseJSON(job.depends_on),
    triggers: safeParseJSON(job.triggers),
    // 确保数字类型
    priority: Number(job.priority),
    max_attempts: Number(job.max_attempts),
    attempts: Number(job.attempts),
    retry_delay_seconds: Number(job.retry_delay_seconds),
    progress_current: Number(job.progress_current),
    progress_total: Number(job.progress_total),
    progress_percentage: Number(job.progress_percentage)
  };
}

  private static prepareJSONField(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  // 如果数据库字段类型是JSON，可以直接传入对象
  // 如果是TEXT字段，需要序列化
  // 这里我们先尝试直接传入对象，如果失败再改为字符串
  return value;
}

private static async findByIdWithTransaction(
  jobId: string,
  dbInstance: Knex | Knex.Transaction
): Promise<ProcessingJob | null> {
  try {
    const job = await dbInstance(this.TABLE_NAME)
      .where('job_id', jobId)
      .first();

    if (!job) return null;
    return this.formatJob(job);
  } catch (error) {
    console.error('查找作业失败:', error);
    throw error;
  }
}

/**
 * 以下方法需要添加到现有的 ProcessingJobModel 类中
 * 这些是Worker系统需要的额外数据库操作方法
 */

/**
 * 更新作业完成状态
 * @param jobId 作业ID
 * @param status 最终状态
 * @param resultData 结果数据
 * @param duration 处理耗时
 * @param memoryUsage 内存使用量
 * @param diskUsage 磁盘使用量
 */
public static async updateJobCompletion(
  jobId: string,
  status: JobStatus.COMPLETED | JobStatus.FAILED,
  resultData?: any,
  duration?: number,
  memoryUsage?: number,
  diskUsage?: number
): Promise<boolean> {
  try {
    const updateData: any = {
      status,
      completed_at: new Date(),
      updated_at: new Date()
    };

    if (duration !== undefined) {
      updateData.processing_duration_ms = duration;
    }

    if (memoryUsage !== undefined) {
      updateData.memory_usage_bytes = memoryUsage;
    }

    if (diskUsage !== undefined) {
      updateData.disk_usage_bytes = diskUsage;
    }

    if (resultData !== undefined) {
      updateData.result_data = JSON.stringify(resultData);
    }

    // 计算队列等待时间
    const job = await this.findById(jobId);
    if (job && job.started_at && job.queued_at) {
      const queueWaitTime = job.started_at.getTime() - job.queued_at.getTime();
      updateData.queue_wait_duration_ms = queueWaitTime;
    }

    const result = await db(this.TABLE_NAME)
      .where('job_id', jobId)
      .update(updateData);

    return result > 0;
  } catch (error) {
    console.error('更新作业完成状态失败:', error);
    throw error;
  }
}

/**
 * 更新作业重试状态
 * @param jobId 作业ID
 * @param errorMessage 错误信息
 * @param errorStack 错误堆栈
 * @param nextRetryAt 下次重试时间
 * @param duration 处理耗时
 */
public static async updateJobRetry(
  jobId: string,
  errorMessage: string,
  errorStack?: string,
  nextRetryAt?: Date,
  duration?: number
): Promise<boolean> {
  try {
    const updateData: any = {
      status: JobStatus.RETRY,
      attempts: db.raw('attempts + 1'),
      error_message: errorMessage,
      error_stack: errorStack,
      next_retry_at: nextRetryAt,
      updated_at: new Date()
    };

    if (duration !== undefined) {
      updateData.processing_duration_ms = duration;
    }

    const result = await db(this.TABLE_NAME)
      .where('job_id', jobId)
      .update(updateData);

    return result > 0;
  } catch (error) {
    console.error('更新作业重试状态失败:', error);
    throw error;
  }
}

/**
 * 更新作业失败状态
 * @param jobId 作业ID
 * @param errorMessage 错误信息
 * @param errorStack 错误堆栈
 * @param duration 处理耗时
 */
public static async updateJobFailure(
  jobId: string,
  errorMessage: string,
  errorStack?: string,
  duration?: number
): Promise<boolean> {
  try {
    const updateData: any = {
      status: JobStatus.FAILED,
      failed_at: new Date(),
      error_message: errorMessage,
      error_stack: errorStack,
      attempts: db.raw('attempts + 1'),
      updated_at: new Date()
    };

    if (duration !== undefined) {
      updateData.processing_duration_ms = duration;
    }

    const result = await db(this.TABLE_NAME)
      .where('job_id', jobId)
      .update(updateData);

    return result > 0;
  } catch (error) {
    console.error('更新作业失败状态失败:', error);
    throw error;
  }
}

/**
 * 更新作业进度
 * @param jobId 作业ID
 * @param current 当前进度
 * @param total 总进度
 * @param message 进度消息
 * @param details 详细信息
 */
public static async updateJobProgress(
  jobId: string,
  current: number,
  total: number,
  message?: string,
  details?: any
): Promise<boolean> {
  try {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    const updateData: any = {
      progress_current: current,
      progress_total: total,
      progress_percentage: Math.round(percentage * 100) / 100, // 保留2位小数
      updated_at: new Date()
    };

    if (message) {
      updateData.progress_message = message;
    }

    if (details) {
      updateData.progress_details = JSON.stringify(details);
    }

    const result = await db(this.TABLE_NAME)
      .where('job_id', jobId)
      .update(updateData);

    return result > 0;
  } catch (error) {
    console.error('更新作业进度失败:', error);
    throw error;
  }
}

/**
 * 重置超时的处理中作业
 * @param timeoutMinutes 超时时间（分钟）
 * @returns 重置的作业数量
 */
public static async resetTimeoutJobs(timeoutMinutes: number = 30): Promise<number> {
  try {
    const timeoutTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    
    const result = await db(this.TABLE_NAME)
      .where('status', JobStatus.PROCESSING)
      .where('started_at', '<', timeoutTime)
      .update({
        status: JobStatus.QUEUED,
        started_at: null,
        worker_id: null,
        error_message: `作业超时重置 (超过${timeoutMinutes}分钟)`,
        updated_at: new Date()
      });

    if (result > 0) {
      console.log(`⚠️ 重置 ${result} 个超时作业`);
    }

    return result;
  } catch (error) {
    console.error('重置超时作业失败:', error);
    throw error;
  }
}

/**
 * 清理旧作业记录
 * @param completedRetentionHours 保留已完成作业的小时数
 * @param failedRetentionHours 保留失败作业的小时数
 * @returns 清理的作业数量
 */
public static async cleanupOldJobs(
  completedRetentionHours: number = 168, // 7天
  failedRetentionHours: number = 720      // 30天
): Promise<{ completed: number; failed: number }> {
  try {
    const completedCutoff = new Date(Date.now() - completedRetentionHours * 60 * 60 * 1000);
    const failedCutoff = new Date(Date.now() - failedRetentionHours * 60 * 60 * 1000);

    // 清理已完成的作业
    const completedDeleted = await db(this.TABLE_NAME)
      .where('status', JobStatus.COMPLETED)
      .where('completed_at', '<', completedCutoff)
      .del();

    // 清理失败的作业
    const failedDeleted = await db(this.TABLE_NAME)
      .where('status', JobStatus.FAILED)
      .where('failed_at', '<', failedCutoff)
      .del();

    if (completedDeleted > 0 || failedDeleted > 0) {
      console.log(`🧹 清理旧作业: ${completedDeleted} 个已完成, ${failedDeleted} 个失败`);
    }

    return {
      completed: completedDeleted,
      failed: failedDeleted
    };
  } catch (error) {
    console.error('清理旧作业失败:', error);
    throw error;
  }
}

/**
 * 获取队列统计信息
 * @param queueName 队列名称（可选）
 * @returns 队列统计
 */
public static async getQueueStats(queueName?: string): Promise<Array<{
  queue_name: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retry: number;
}>> {
  try {
    let query = db(this.TABLE_NAME)
      .select('queue_name')
      .select(db.raw(`
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'retry' THEN 1 ELSE 0 END) as retry
      `))
      .groupBy('queue_name');

    if (queueName) {
      query = query.where('queue_name', queueName);
    }

    const stats = await query;

    return stats.map(stat => ({
      queue_name: stat.queue_name,
      pending: Number(stat.pending),
      processing: Number(stat.processing),
      completed: Number(stat.completed),
      failed: Number(stat.failed),
      retry: Number(stat.retry)
    }));
  } catch (error) {
    console.error('获取队列统计失败:', error);
    throw error;
  }
}

/**
 * 获取Worker统计信息
 * @param workerName Worker名称（可选）
 * @returns Worker统计
 */
public static async getWorkerStats(workerName?: string): Promise<Array<{
  worker_id: string;
  active_jobs: number;
  total_processed: number;
  success_rate: number;
  avg_processing_time: number;
}>> {
  try {
    let query = db(this.TABLE_NAME)
      .select('worker_id')
      .select(db.raw(`
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as active_jobs,
        COUNT(*) as total_processed,
        (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate,
        AVG(processing_duration_ms) as avg_processing_time
      `))
      .whereNotNull('worker_id')
      .groupBy('worker_id');

    if (workerName) {
      query = query.where('worker_id', workerName);
    }

    const stats = await query;

    return stats.map(stat => ({
      worker_id: stat.worker_id,
      active_jobs: Number(stat.active_jobs),
      total_processed: Number(stat.total_processed),
      success_rate: Number(stat.success_rate) || 0,
      avg_processing_time: Number(stat.avg_processing_time) || 0
    }));
  } catch (error) {
    console.error('获取Worker统计失败:', error);
    throw error;
  }
}



}

// 导出作业模型类
export default ProcessingJobModel;