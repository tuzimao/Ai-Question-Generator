// src/workers/WorkerManager.ts - Worker管理器

import { EventEmitter } from 'events';
import { BaseWorker } from './BaseWorker';
import { 
  //WorkerConfig, 
  WorkerState, 
  WorkerStats, 
  SystemHealth,
  WorkerEvent,
  WorkerEventData
} from '@/types/worker';

/**
 * Worker管理器
 * 
 * 负责管理所有Worker实例：
 * - Worker注册和生命周期管理
 * - 系统健康监控
 * - 统一的启动和停止控制
 * - 事件聚合和分发
 */
export class WorkerManager extends EventEmitter {
  private workers: Map<string, BaseWorker> = new Map();
  private healthCheckTimer: NodeJS.Timeout | undefined;
  private isShuttingDown = false;

  constructor() {
    super();
    console.log('🎛️ WorkerManager 初始化');
    
    // 监听进程退出信号，优雅关闭
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      console.error('💥 未捕获异常:', error);
      this.gracefulShutdown('uncaughtException');
    });
  }

  /**
   * 注册Worker
   */
  public registerWorker(worker: BaseWorker): void {
    const workerName = worker.getStats().name;
    
    if (this.workers.has(workerName)) {
      throw new Error(`Worker ${workerName} 已经注册`);
    }

    console.log(`📝 注册Worker: ${workerName}`);
    
    // 注册Worker
    this.workers.set(workerName, worker);
    
    // 监听Worker事件
    worker.on(WorkerEvent.STARTED, (data: WorkerEventData) => {
      console.log(`🚀 Worker启动: ${data.workerName}`);
      this.emit(WorkerEvent.STARTED, data);
    });
    
    worker.on(WorkerEvent.STOPPED, (data: WorkerEventData) => {
      console.log(`🛑 Worker停止: ${data.workerName}`);
      this.emit(WorkerEvent.STOPPED, data);
    });
    
    worker.on(WorkerEvent.JOB_STARTED, (data: WorkerEventData) => {
      console.log(`🔄 作业开始: ${data.jobId} (Worker: ${data.workerName})`);
      this.emit(WorkerEvent.JOB_STARTED, data);
    });
    
    worker.on(WorkerEvent.JOB_COMPLETED, (data: WorkerEventData) => {
      console.log(`✅ 作业完成: ${data.jobId} (Worker: ${data.workerName})`);
      this.emit(WorkerEvent.JOB_COMPLETED, data);
    });
    
    worker.on(WorkerEvent.JOB_FAILED, (data: WorkerEventData) => {
      console.log(`❌ 作业失败: ${data.jobId} (Worker: ${data.workerName})`);
      this.emit(WorkerEvent.JOB_FAILED, data);
    });
    
    worker.on(WorkerEvent.JOB_PROGRESS, (data: WorkerEventData) => {
      this.emit(WorkerEvent.JOB_PROGRESS, data);
    });
    
    worker.on(WorkerEvent.ERROR, (data: WorkerEventData) => {
      console.error(`💥 Worker错误: ${data.workerName}`, data.error);
      this.emit(WorkerEvent.ERROR, data);
    });
  }

  /**
   * 启动所有Worker
   */
  public async startAll(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('系统正在关闭中，无法启动Worker');
    }

    console.log(`🚀 启动所有Worker (${this.workers.size}个)`);
    
    const startPromises = Array.from(this.workers.values()).map(async (worker) => {
      try {
        await worker.start();
      } catch (error) {
        console.error(`❌ Worker ${worker.getStats().name} 启动失败:`, error);
        throw error;
      }
    });

    await Promise.all(startPromises);
    
    // 启动健康检查
    this.startHealthCheck();
    
    console.log('✅ 所有Worker启动完成');
  }

  /**
   * 停止所有Worker
   */
  public async stopAll(): Promise<void> {
    console.log(`🛑 停止所有Worker (${this.workers.size}个)`);
    
    // 停止健康检查
    this.stopHealthCheck();
    
    const stopPromises = Array.from(this.workers.values()).map(async (worker) => {
      try {
        await worker.stop();
      } catch (error) {
        console.error(`❌ Worker ${worker.getStats().name} 停止失败:`, error);
      }
    });

    await Promise.allSettled(stopPromises);
    console.log('✅ 所有Worker已停止');
  }

  /**
   * 启动指定Worker
   */
  public async startWorker(workerName: string): Promise<void> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} 不存在`);
    }

    await worker.start();
  }

  /**
   * 停止指定Worker
   */
  public async stopWorker(workerName: string): Promise<void> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} 不存在`);
    }

    await worker.stop();
  }

  /**
   * 获取Worker统计信息
   */
  public getWorkerStats(workerName?: string): WorkerStats | WorkerStats[] {
    if (workerName) {
      const worker = this.workers.get(workerName);
      if (!worker) {
        throw new Error(`Worker ${workerName} 不存在`);
      }
      return worker.getStats();
    }

    // 返回所有Worker统计
    return Array.from(this.workers.values()).map(worker => worker.getStats());
  }

  /**
   * 获取系统健康状态
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    const workerStats = Array.from(this.workers.values()).map(worker => worker.getStats());
    
    // 计算整体健康状态
    const healthyWorkers = workerStats.filter(stats => 
      stats.state === WorkerState.RUNNING && stats.errorRate < 0.1
    );
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyWorkers.length === workerStats.length) {
      status = 'healthy';
    } else if (healthyWorkers.length > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    // 获取队列统计（简化版本，实际应该查询数据库）
    const queues = await this.getQueueStats();
    
    // 获取系统负载（简化版本）
    const systemLoad = this.getSystemLoad();

    return {
      status,
      workers: workerStats,
      queues,
      systemLoad,
      timestamp: new Date()
    };
  }

  /**
   * 重启Worker
   */
  public async restartWorker(workerName: string): Promise<void> {
    console.log(`🔄 重启Worker: ${workerName}`);
    
    await this.stopWorker(workerName);
    await this.sleep(1000); // 等待1秒
    await this.startWorker(workerName);
    
    console.log(`✅ Worker ${workerName} 重启完成`);
  }

  /**
   * 重启所有Worker
   */
  public async restartAll(): Promise<void> {
    console.log('🔄 重启所有Worker');
    
    await this.stopAll();
    await this.sleep(2000); // 等待2秒
    await this.startAll();
    
    console.log('✅ 所有Worker重启完成');
  }

  /**
   * 获取Worker列表
   */
  public getWorkerNames(): string[] {
    return Array.from(this.workers.keys());
  }

  /**
   * 检查Worker是否存在
   */
  public hasWorker(workerName: string): boolean {
    return this.workers.has(workerName);
  }

  /**
   * 获取运行中的Worker数量
   */
  public getRunningWorkerCount(): number {
    return Array.from(this.workers.values())
      .filter(worker => worker.getStats().state === WorkerState.RUNNING)
      .length;
  }

  /**
   * 优雅关闭
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log('🔄 关闭信号已接收，等待中...');
      return;
    }

    console.log(`📢 接收到关闭信号: ${signal}`);
    this.isShuttingDown = true;

    try {
      // 设置关闭超时
      const shutdownTimeout = setTimeout(() => {
        console.error('⏰ 优雅关闭超时，强制退出');
        process.exit(1);
      }, 30000); // 30秒超时

      await this.stopAll();
      
      clearTimeout(shutdownTimeout);
      console.log('✅ 优雅关闭完成');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ 优雅关闭失败:', error);
      process.exit(1);
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        if (health.status === 'unhealthy') {
          console.warn('⚠️ 系统健康状态: 不健康');
          this.emit('system_unhealthy', health);
        }
        
        // 发送健康检查事件
        this.emit('health_check', health);
        
      } catch (error) {
        console.error('❌ 健康检查失败:', error);
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * 获取队列统计信息
   */
  private async getQueueStats(): Promise<Array<{
    name: string;
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }>> {
    try {
      const { db } = await import('@/utils/database');
      
      // 查询各队列的统计信息
      const stats = await db('processing_jobs')
        .select('queue_name as name')
        .select(db.raw(`
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        `))
        .groupBy('queue_name');

      return stats.map(stat => ({
        name: stat.name,
        pending: Number(stat.pending),
        active: Number(stat.active),
        completed: Number(stat.completed),
        failed: Number(stat.failed)
      }));
      
    } catch (error) {
      console.error('获取队列统计失败:', error);
      return [];
    }
  }

  /**
   * 获取系统负载
   */
  private getSystemLoad(): { cpu: number; memory: number; disk: number } {
    try {
      const os = require('os');
     // const process = require('process');
      
      // CPU负载（简化）
      const cpuLoad = os.loadavg()[0] / os.cpus().length;
      
      // 内存使用率
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = (totalMemory - freeMemory) / totalMemory;
      
      // 磁盘使用率（简化，实际需要更复杂的逻辑）
      const diskUsage = 0.5; // 占位符
      
      return {
        cpu: Math.min(cpuLoad, 1.0),
        memory: memoryUsage,
        disk: diskUsage
      };
    } catch (error) {
      console.error('获取系统负载失败:', error);
      return { cpu: 0, memory: 0, disk: 0 };
    }
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}