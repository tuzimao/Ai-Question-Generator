// src/workers/WorkerBootstrap.ts - Worker启动引导程序

import { WorkerManager } from './WorkerManager';
//import { WorkerConfiguration } from '@/config/worker';
import { Database } from '@/utils/database';
import { WorkerRegistry } from './WorkerRegistry';

/**
 * Worker启动引导程序
 * 负责初始化和启动所有Worker
 */
export class WorkerBootstrap {
  private workerManager: WorkerManager;
  private maintenanceTimer?: NodeJS.Timeout | undefined;

  constructor() {
    this.workerManager = new WorkerManager();
  }

  /**
   * 初始化Worker系统
   */
  public async initialize(): Promise<void> {
    try {
      console.log('🔧 初始化Worker系统...');

      // 确保数据库连接
      if (!Database.isConnectedToDatabase()) {
        await Database.initialize();
      }

      // 重置超时的作业
      await this.resetTimeoutJobs();

      // 注册事件监听器
      this.registerEventListeners();

      // 开始维护任务
      this.startMaintenanceTasks();

      console.log('✅ Worker系统初始化完成');
      
    } catch (error) {
      console.error('❌ Worker系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动所有Worker
   */
  public async startWorkers(): Promise<void> {
    try {
      console.log('🚀 启动Worker服务...');

      // 创建并注册Worker实例
      await this.registerWorkers();

      // 启动所有Worker
      await this.workerManager.startAll();

      console.log('✅ 所有Worker启动完成');
      
    } catch (error) {
      console.error('❌ Worker启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止所有Worker
   */
  public async stopWorkers(): Promise<void> {
    try {
      console.log('🛑 停止Worker服务...');

      // 停止维护任务
      this.stopMaintenanceTasks();

      // 停止所有Worker
      await this.workerManager.stopAll();

      console.log('✅ 所有Worker已停止');
      
    } catch (error) {
      console.error('❌ Worker停止失败:', error);
      throw error;
    }
  }

  /**
   * 获取Worker管理器
   */
  public getWorkerManager(): WorkerManager {
    return this.workerManager;
  }

  /**
   * 获取系统健康状态
   */
  public async getSystemHealth() {
    return await this.workerManager.getSystemHealth();
  }

  /**
   * 注册Worker实例
   */
private async registerWorkers(): Promise<void> {
  const workers = WorkerRegistry.createAllWorkers();
  
  for (const worker of workers) {
    this.workerManager.registerWorker(worker);
    console.log(`📝 注册Worker: ${worker.getStats().name}`);
  }
  
  if (workers.length === 0) {
    console.warn('⚠️ 没有可用的Worker被创建');
  } else {
    console.log(`✅ 成功注册 ${workers.length} 个Worker`);
  }
}

  /**
   * 注册事件监听器
   */
  private registerEventListeners(): void {
    this.workerManager.on('system_unhealthy', (health) => {
      console.warn('⚠️ 系统健康警告:', health);
      // TODO: 这里可以添加告警通知逻辑
    });

    this.workerManager.on('job_failed', (data) => {
      console.error(`❌ 作业失败: ${data.jobId} (Worker: ${data.workerName})`);
      // TODO: 这里可以添加失败作业的特殊处理逻辑
    });

    this.workerManager.on('worker_error', (data) => {
      console.error(`💥 Worker错误: ${data.workerName}`, data.error);
      // TODO: 这里可以添加Worker重启逻辑
    });
  }

  /**
   * 开始维护任务
   */
  private startMaintenanceTasks(): void {
    // 每小时执行一次维护任务
    this.maintenanceTimer = setInterval(async () => {
      try {
        await this.performMaintenance();
      } catch (error) {
        console.error('❌ 维护任务执行失败:', error);
      }
    }, 60 * 60 * 1000); // 1小时

    console.log('🔧 维护任务已启动');
  }

  /**
   * 停止维护任务
   */
  private stopMaintenanceTasks(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = undefined;
    }
  }

  /**
   * 执行维护任务
   */
  private async performMaintenance(): Promise<void> {
    console.log('🔧 执行维护任务...');

    // 重置超时作业
    await this.resetTimeoutJobs();

    // 清理旧作业记录
    await this.cleanupOldJobs();

    // 检查系统健康状态
    const health = await this.workerManager.getSystemHealth();
    console.log(`📊 系统健康状态: ${health.status}`);
  }

  /**
   * 重置超时作业
   */
  private async resetTimeoutJobs(): Promise<void> {
    try {
      const ProcessingJobModel = (await import('@/models/ProcessingJob')).default;
      const resetCount = await ProcessingJobModel.resetTimeoutJobs(30); // 30分钟超时
      
      if (resetCount > 0) {
        console.log(`⚠️ 重置 ${resetCount} 个超时作业`);
      }
    } catch (error) {
      console.error('重置超时作业失败:', error);
    }
  }

  /**
   * 清理旧作业记录
   */
  private async cleanupOldJobs(): Promise<void> {
    try {
      const ProcessingJobModel = (await import('@/models/ProcessingJob')).default;
      const cleaned = await ProcessingJobModel.cleanupOldJobs(168, 720); // 7天完成作业，30天失败作业
      
      if (cleaned.completed > 0 || cleaned.failed > 0) {
        console.log(`🧹 清理旧作业: ${cleaned.completed} 个已完成, ${cleaned.failed} 个失败`);
      }
    } catch (error) {
      console.error('清理旧作业失败:', error);
    }
  }
}

// 全局Worker启动器实例
export const workerBootstrap = new WorkerBootstrap();