// src/types/worker.ts - Worker系统类型定义

import { ProcessingJob, JobStatus, JobType } from '@/models/ProcessingJob';

/**
 * Worker配置接口
 */
export interface WorkerConfig {
  /** Worker名称 */
  name: string;
  /** 并发处理数量 */
  concurrency: number;
  /** 队列名称 */
  queueName: string;
  /** 轮询间隔（毫秒） */
  pollInterval: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 处理超时时间（毫秒） */
  timeout: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * Worker状态枚举
 */
export enum WorkerState {
  IDLE = 'idle',           // 空闲
  RUNNING = 'running',     // 运行中
  STOPPING = 'stopping',   // 停止中
  STOPPED = 'stopped',     // 已停止
  ERROR = 'error'          // 错误状态
}

/**
 * 作业处理上下文
 */
export interface JobContext {
  /** 作业信息 */
  job: ProcessingJob;
  /** 开始时间 */
  startTime: Date;
  /** Worker名称 */
  workerName: string;
  /** 请求ID */
  requestId: string;
  /** 取消标志 */
  cancelled: boolean;
}

/**
 * 作业处理结果
 */
export interface JobResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
  /** 错误堆栈 */
  errorStack?: string;
  /** 处理耗时（毫秒） */
  duration: number;
  /** 内存使用量（字节） */
  memoryUsage?: number;
  /** 磁盘使用量（字节） */
  diskUsage?: number;
}

/**
 * Worker统计信息
 */
export interface WorkerStats {
  /** Worker名称 */
  name: string;
  /** 当前状态 */
  state: WorkerState;
  /** 启动时间 */
  startTime?: Date;
  /** 处理的作业总数 */
  processedJobs: number;
  /** 成功的作业数 */
  successfulJobs: number;
  /** 失败的作业数 */
  failedJobs: number;
  /** 当前活跃作业数 */
  activeJobs: number;
  /** 平均处理时间（毫秒） */
  averageProcessingTime: number;
  /** 最后一次活动时间 */
  lastActivity?: Date;
  /** 错误率 */
  errorRate: number;
}

/**
 * 进度更新接口
 */
export interface ProgressUpdate {
  /** 当前进度 */
  current: number;
  /** 总进度 */
  total: number;
  /** 进度消息 */
  message?: string;
  /** 详细信息 */
  details?: Record<string, any>;
}

/**
 * Worker事件类型
 */
export enum WorkerEvent {
  STARTED = 'started',
  STOPPED = 'stopped',
  JOB_STARTED = 'job_started',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',
  JOB_PROGRESS = 'job_progress',
  ERROR = 'error'
}

/**
 * Worker事件数据
 */
export interface WorkerEventData {
  workerName: string;
  jobId?: string;
  error?: Error;
  progress?: ProgressUpdate;
  result?: JobResult;
  timestamp: Date;
}

/**
 * 队列配置
 */
export interface QueueConfig {
  /** 队列名称 */
  name: string;
  /** 最大作业数 */
  maxJobs: number;
  /** 优先级范围 */
  priorityRange: [number, number];
  /** 清理策略 */
  cleanupPolicy: {
    /** 保留完成作业的时间（小时） */
    retainCompletedHours: number;
    /** 保留失败作业的时间（小时） */
    retainFailedHours: number;
  };
}

/**
 * 系统健康状态
 */
export interface SystemHealth {
  /** 整体状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Worker状态列表 */
  workers: WorkerStats[];
  /** 队列统计 */
  queues: {
    name: string;
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }[];
  /** 系统负载 */
  systemLoad: {
    cpu: number;
    memory: number;
    disk: number;
  };
  /** 检查时间 */
  timestamp: Date;
}