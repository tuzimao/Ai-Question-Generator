// src/config/worker.ts - Worker配置管理

import { WorkerConfig } from '@/types/worker';

/**
 * Worker配置管理类
 * 提供所有Worker的配置信息和工厂方法
 */
export class WorkerConfiguration {
  /**
   * 获取默认的Worker配置
   */
  public static getDefaultConfig(): Partial<WorkerConfig> {
    return {
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
      pollInterval: parseInt(process.env.WORKER_POLL_INTERVAL || '5000', 10),
      maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3', 10),
      timeout: parseInt(process.env.WORKER_TIMEOUT || '300000', 10), // 5分钟
      enabled: process.env.NODE_ENV !== 'test' // 测试环境默认禁用
    };
  }

  /**
   * 获取文档解析Worker配置
   */
  public static getParseWorkerConfig(): WorkerConfig {
    const defaults = this.getDefaultConfig();
    
    return {
      name: 'document-parser',
      queueName: 'document-processing',
      concurrency: parseInt(process.env.PARSE_WORKER_CONCURRENCY || '3', 10),
      pollInterval: parseInt(process.env.PARSE_WORKER_POLL_INTERVAL || '3000', 10),
      maxRetries: parseInt(process.env.PARSE_WORKER_MAX_RETRIES || '3', 10),
      timeout: parseInt(process.env.PARSE_WORKER_TIMEOUT || '600000', 10), // 10分钟
      enabled: process.env.PARSE_WORKER_ENABLED !== 'false',
      ...defaults
    };
  }

  /**
   * 获取文档分块Worker配置
   */
  public static getChunkWorkerConfig(): WorkerConfig {
    const defaults = this.getDefaultConfig();
    
    return {
      name: 'document-chunker',
      queueName: 'chunk-processing',
      concurrency: parseInt(process.env.CHUNK_WORKER_CONCURRENCY || '5', 10),
      pollInterval: parseInt(process.env.CHUNK_WORKER_POLL_INTERVAL || '2000', 10),
      maxRetries: parseInt(process.env.CHUNK_WORKER_MAX_RETRIES || '2', 10),
      timeout: parseInt(process.env.CHUNK_WORKER_TIMEOUT || '300000', 10), // 5分钟
      enabled: process.env.CHUNK_WORKER_ENABLED !== 'false',
      ...defaults
    };
  }

  /**
   * 获取清理Worker配置
   */
  public static getCleanupWorkerConfig(): WorkerConfig {
    const defaults = this.getDefaultConfig();
    
    return {
      name: 'system-cleanup',
      queueName: 'cleanup-processing',
      concurrency: 1, // 清理任务单线程
      pollInterval: parseInt(process.env.CLEANUP_WORKER_POLL_INTERVAL || '60000', 10), // 1分钟
      maxRetries: parseInt(process.env.CLEANUP_WORKER_MAX_RETRIES || '1', 10),
      timeout: parseInt(process.env.CLEANUP_WORKER_TIMEOUT || '120000', 10), // 2分钟
      enabled: process.env.CLEANUP_WORKER_ENABLED !== 'false',
      ...defaults
    };
  }

  /**
   * 获取所有Worker配置
   */
  public static getAllConfigs(): WorkerConfig[] {
    return [
      this.getParseWorkerConfig(),
      this.getChunkWorkerConfig(),
      this.getCleanupWorkerConfig()
    ];
  }

  /**
   * 验证Worker配置
   */
  public static validateConfig(config: WorkerConfig): boolean {
    const errors: string[] = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Worker名称不能为空');
    }

    if (!config.queueName || config.queueName.trim().length === 0) {
      errors.push('队列名称不能为空');
    }

    if (config.concurrency < 1 || config.concurrency > 10) {
      errors.push('并发数量必须在1-10之间');
    }

    if (config.pollInterval < 1000 || config.pollInterval > 60000) {
      errors.push('轮询间隔必须在1-60秒之间');
    }

    if (config.maxRetries < 0 || config.maxRetries > 10) {
      errors.push('最大重试次数必须在0-10之间');
    }

    if (config.timeout < 10000 || config.timeout > 3600000) {
      errors.push('超时时间必须在10秒-1小时之间');
    }

    if (errors.length > 0) {
      console.error(`❌ Worker配置验证失败 (${config.name}):`, errors);
      return false;
    }

    return true;
  }
}