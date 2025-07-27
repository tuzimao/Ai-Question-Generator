// src/workers/BaseWorker.ts - 基础Worker类

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { Database } from '@/utils/database';
import ProcessingJobModel, { ProcessingJob, JobStatus, JobType } from '@/models/ProcessingJob';
import { 
  WorkerConfig, 
  WorkerState, 
  JobContext, 
  JobResult, 
  WorkerStats, 
  ProgressUpdate,
  WorkerEvent,
  WorkerEventData
} from '@/types/worker';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 基础Worker抽象类
 * 
 * 提供所有Worker的通用功能：
 * - 作业轮询和处理
 * - 进度更新和状态管理
 * - 错误处理和重试机制
 * - 并发控制和资源管理
 * - 统计信息和健康检查
 */
export abstract class BaseWorker extends EventEmitter {
  protected readonly config: WorkerConfig;
  protected state: WorkerState = WorkerState.STOPPED;
  protected startTime?: Date;
  protected activeJobs: Map<string, JobContext> = new Map();
  protected stats: WorkerStats;
  private pollTimer?: NodeJS.Timeout | undefined;
  private gracefulShutdown = false;

  constructor(config: WorkerConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    
    console.log(`🔧 Worker初始化: ${config.name} (队列: ${config.queueName})`);
  }

  /**
   * 抽象方法：具体的作业处理逻辑
   * 子类必须实现此方法
   */
  protected abstract processJob(context: JobContext): Promise<JobResult>;

  /**
   * 启动Worker
   */
  public async start(): Promise<void> {
    if (this.state === WorkerState.RUNNING) {
      console.warn(`⚠️ Worker ${this.config.name} 已经在运行中`);
      return;
    }

    if (!this.config.enabled) {
      console.log(`⏸️ Worker ${this.config.name} 已禁用，跳过启动`);
      return;
    }

    try {
      console.log(`🚀 启动Worker: ${this.config.name}`);
      
      this.state = WorkerState.RUNNING;
      this.startTime = new Date();
      this.gracefulShutdown = false;
      
      // 重置统计信息
      this.stats = this.initializeStats();
      this.stats.state = WorkerState.RUNNING;
      this.stats.startTime = this.startTime;

      // 开始轮询作业
      this.startPolling();

      // 发送启动事件
      this.emitEvent(WorkerEvent.STARTED, {});

      console.log(`✅ Worker ${this.config.name} 启动成功`);
      
    } catch (error) {
      console.error(`❌ Worker ${this.config.name} 启动失败:`, error);
      this.state = WorkerState.ERROR;
      throw error;
    }
  }

  /**
   * 停止Worker
   */
  public async stop(): Promise<void> {
    if (this.state === WorkerState.STOPPED) {
      console.warn(`⚠️ Worker ${this.config.name} 已经停止`);
      return;
    }

    console.log(`🛑 停止Worker: ${this.config.name}`);
    this.state = WorkerState.STOPPING;
    this.gracefulShutdown = true;

    // 停止轮询
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    // 等待活跃作业完成（最多等待30秒）
    const maxWaitTime = 30000; // 30秒
    const waitStart = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - waitStart) < maxWaitTime) {
      console.log(`⏳ 等待 ${this.activeJobs.size} 个活跃作业完成...`);
      await this.sleep(1000);
    }

    // 强制取消剩余作业
    for (const context of this.activeJobs.values()) {
      context.cancelled = true;
      console.warn(`⚠️ 强制取消作业: ${context.job.job_id}`);
    }

    this.state = WorkerState.STOPPED;
    this.stats.state = WorkerState.STOPPED;

    // 发送停止事件
    this.emitEvent(WorkerEvent.STOPPED, {});

    console.log(`✅ Worker ${this.config.name} 已停止`);
  }

  /**
   * 获取Worker统计信息
   */
  public getStats(): WorkerStats {
    // 更新实时统计
    this.stats.activeJobs = this.activeJobs.size;
    this.stats.lastActivity = new Date();
    
    // 计算错误率
    if (this.stats.processedJobs > 0) {
      this.stats.errorRate = this.stats.failedJobs / this.stats.processedJobs;
    }

    return { ...this.stats };
  }

  /**
   * 检查Worker健康状态
   */
  public isHealthy(): boolean {
    return this.state === WorkerState.RUNNING && 
           this.stats.errorRate < 0.1 && // 错误率小于10%
           this.activeJobs.size <= this.config.concurrency;
  }

  /**
   * 开始轮询作业
   */
  private startPolling(): void {
    if (this.gracefulShutdown || this.state !== WorkerState.RUNNING) {
      return;
    }

    // 检查是否还有处理能力
    if (this.activeJobs.size >= this.config.concurrency) {
      // 当前已达到最大并发，稍后重试
      this.scheduleNextPoll();
      return;
    }

    // 获取并处理作业
    this.pollAndProcessJobs()
      .catch(error => {
        console.error(`❌ Worker ${this.config.name} 轮询作业失败:`, error);
        this.emitEvent(WorkerEvent.ERROR, { error });
      })
      .finally(() => {
        this.scheduleNextPoll();
      });
  }

  /**
   * 轮询并处理作业
   */
  private async pollAndProcessJobs(): Promise<void> {
    try {
      // 计算需要获取的作业数量
      const availableSlots = this.config.concurrency - this.activeJobs.size;
      if (availableSlots <= 0) {
        return;
      }

      // 从数据库获取待处理作业
      const jobs = await this.fetchPendingJobs(availableSlots);
      
      if (jobs.length === 0) {
        return; // 没有待处理作业
      }

      console.log(`📝 Worker ${this.config.name} 获取到 ${jobs.length} 个待处理作业`);

      // 并行处理多个作业
      const processingPromises = jobs.map(job => this.handleSingleJob(job));
      await Promise.allSettled(processingPromises);

    } catch (error) {
      console.error(`❌ 轮询作业过程出错:`, error);
      throw error;
    }
  }

  /**
   * 从数据库获取待处理作业
   */
  private async fetchPendingJobs(limit: number): Promise<ProcessingJob[]> {
    try {
      return await Database.withTransaction(async (trx: Knex.Transaction) => {
        // 查询待处理作业（使用悲观锁防止并发）
        const jobs = await trx('processing_jobs')
          .select('*')
          .where('queue_name', this.config.queueName)
          .where('status', JobStatus.QUEUED)
          .where(function() {
            this.whereNull('next_retry_at')
              .orWhere('next_retry_at', '<=', new Date());
          })
          .orderBy('priority', 'asc')
          .orderBy('created_at', 'asc')
          .limit(limit)
          .forUpdate(); // 悲观锁

        if (jobs.length === 0) {
          return [];
        }

        // 原子性更新作业状态为处理中
        const jobIds = jobs.map(job => job.job_id);
        await trx('processing_jobs')
          .whereIn('job_id', jobIds)
          .update({
            status: JobStatus.PROCESSING,
            started_at: new Date(),
            worker_id: this.config.name,
            updated_at: new Date()
          });

        return jobs.map(job => ({
          ...job,
          status: JobStatus.PROCESSING,
          started_at: new Date(),
          worker_id: this.config.name
        }));
      });
    } catch (error) {
      console.error('获取待处理作业失败:', error);
      return [];
    }
  }

  /**
   * 处理单个作业
   */
  private async handleSingleJob(job: ProcessingJob): Promise<void> {
    const context: JobContext = {
      job,
      startTime: new Date(),
      workerName: this.config.name,
      requestId: uuidv4(),
      cancelled: false
    };

    // 记录活跃作业
    this.activeJobs.set(job.job_id, context);
    this.stats.processedJobs++;

    // 发送作业开始事件
    this.emitEvent(WorkerEvent.JOB_STARTED, { jobId: job.job_id });

    try {
      console.log(`🔄 开始处理作业: ${job.job_id} (类型: ${job.job_type})`);

      // 设置超时处理
      const timeoutPromise = new Promise<JobResult>((_, reject) => {
        setTimeout(() => {
          context.cancelled = true;
          reject(new Error(`作业处理超时 (${this.config.timeout}ms)`));
        }, this.config.timeout);
      });

      // 执行作业处理
      const processingPromise = this.processJob(context);
      const result = await Promise.race([processingPromise, timeoutPromise]);

      // 检查是否被取消
      if (context.cancelled) {
        throw new Error('作业已被取消');
      }

      // 处理成功
      await this.handleJobSuccess(context, result);

    } catch (error) {
      // 处理失败
      await this.handleJobFailure(context, error);
    } finally {
      // 清理活跃作业记录
      this.activeJobs.delete(job.job_id);
    }
  }

  /**
   * 处理作业成功
   */
  private async handleJobSuccess(context: JobContext, result: JobResult): Promise<void> {
    this.stats.successfulJobs++;
    
    // 更新平均处理时间
    this.updateAverageProcessingTime(result.duration);

    try {
      // 更新数据库状态
      await ProcessingJobModel.updateJobCompletion(
        context.job.job_id,
        JobStatus.COMPLETED,
        result.data,
        result.duration,
        result.memoryUsage,
        result.diskUsage
      );

      console.log(`✅ 作业处理成功: ${context.job.job_id} (耗时: ${result.duration}ms)`);

      // 发送成功事件
      this.emitEvent(WorkerEvent.JOB_COMPLETED, { 
        jobId: context.job.job_id, 
        result 
      });

    } catch (error) {
      console.error(`❌ 更新作业成功状态失败:`, error);
    }
  }

  /**
   * 处理作业失败
   */
  private async handleJobFailure(context: JobContext, error: any): Promise<void> {
    this.stats.failedJobs++;
    const errorMessage = getErrorMessage(error);
    const duration = Date.now() - context.startTime.getTime();

    console.error(`❌ 作业处理失败: ${context.job.job_id}`, errorMessage);

    try {
      // 检查是否需要重试
      const shouldRetry = context.job.attempts < context.job.max_attempts;
      
      if (shouldRetry) {
        // 计算下次重试时间
        const retryDelay = this.calculateRetryDelay(context.job.attempts);
        const nextRetryAt = new Date(Date.now() + retryDelay);

        await ProcessingJobModel.updateJobRetry(
          context.job.job_id,
          errorMessage,
          error.stack,
          nextRetryAt,
          duration
        );

        console.log(`🔄 作业将重试: ${context.job.job_id} (${context.job.attempts + 1}/${context.job.max_attempts})`);
      } else {
        // 达到最大重试次数，标记为失败
        await ProcessingJobModel.updateJobFailure(
          context.job.job_id,
          errorMessage,
          error.stack,
          duration
        );

        console.log(`💀 作业最终失败: ${context.job.job_id}`);
      }

      // 发送失败事件
      this.emitEvent(WorkerEvent.JOB_FAILED, { 
        jobId: context.job.job_id, 
        error 
      });

    } catch (updateError) {
      console.error(`❌ 更新作业失败状态失败:`, updateError);
    }
  }

  /**
   * 更新作业进度
   */
  protected async updateProgress(
    jobId: string, 
    progress: ProgressUpdate
  ): Promise<void> {
    try {
      await ProcessingJobModel.updateJobProgress(
        jobId,
        progress.current,
        progress.total,
        progress.message,
        progress.details
      );

      // 发送进度事件
      this.emitEvent(WorkerEvent.JOB_PROGRESS, { 
        jobId, 
        progress 
      });

    } catch (error) {
      console.error(`❌ 更新作业进度失败:`, error);
    }
  }

  /**
   * 计算重试延迟（指数退避）
   */
  private calculateRetryDelay(attempts: number): number {
    const baseDelay = this.config.maxRetries * 1000; // 基础延迟
    const exponentialDelay = Math.pow(2, attempts) * 1000; // 指数退避
    const jitter = Math.random() * 1000; // 随机抖动
    
    return Math.min(baseDelay + exponentialDelay + jitter, 300000); // 最大5分钟
  }

  /**
   * 更新平均处理时间
   */
  private updateAverageProcessingTime(duration: number): void {
    if (this.stats.processedJobs === 1) {
      this.stats.averageProcessingTime = duration;
    } else {
      // 使用移动平均
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * 0.9) + (duration * 0.1);
    }
  }

  /**
   * 发送Worker事件
   */
  private emitEvent(event: WorkerEvent, data: Partial<WorkerEventData>): void {
    const eventData: WorkerEventData = {
      workerName: this.config.name,
      timestamp: new Date(),
      ...data
    };
    
    this.emit(event, eventData);
  }

  /**
   * 调度下次轮询
   */
  private scheduleNextPoll(): void {
    if (this.gracefulShutdown || this.state !== WorkerState.RUNNING) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      this.startPolling();
    }, this.config.pollInterval);
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): WorkerStats {
    return {
      name: this.config.name,
      state: WorkerState.STOPPED,
      processedJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      averageProcessingTime: 0,
      errorRate: 0
    };
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}