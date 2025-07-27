// src/workers/TestWorker.ts - 示例测试Worker

import { BaseWorker } from './BaseWorker';
import { JobContext, JobResult, WorkerConfig } from '@/types/worker';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 测试Worker
 * 用于验证Worker基础设施是否正常工作
 * 
 * 功能：
 * - 模拟文档处理流程
 * - 测试进度更新
 * - 验证错误处理
 * - 演示Worker生命周期
 */
export class TestWorker extends BaseWorker {
  constructor(config: WorkerConfig) {
    super(config);
    console.log(`🧪 TestWorker创建: ${config.name}`);
  }

  /**
   * 实现具体的作业处理逻辑
   */
  protected async processJob(context: JobContext): Promise<JobResult> {
    const { job, startTime } = context;
    
    console.log(`🧪 开始测试作业: ${job.job_id}`);
    
    try {
      // 模拟处理步骤
      await this.simulateProcessing(job.job_id, context);
      
      // 计算处理耗时
      const duration = Date.now() - startTime.getTime();
      
      // 生成测试结果
      const result: JobResult = {
        success: true,
        data: {
          jobId: job.job_id,
          docId: job.doc_id,
          processedAt: new Date().toISOString(),
          steps: ['初始化', '模拟处理', '验证', '完成'],
          metadata: {
            workerName: this.config.name,
            processingTime: duration,
            testData: this.generateTestData()
          }
        },
        duration,
        memoryUsage: this.getCurrentMemoryUsage(),
        diskUsage: 0 // 测试Worker不使用磁盘
      };

      console.log(`✅ 测试作业完成: ${job.job_id} (耗时: ${duration}ms)`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime.getTime();
      
      console.error(`❌ 测试作业失败: ${job.job_id}`, error);
      
      const result: JobResult = {
        success: false,
        error: getErrorMessage(error),
        duration
      };
      if (error instanceof Error && typeof error.stack === 'string') {
        (result as any).errorStack = error.stack;
      }
      return result;
    }
  }

  /**
   * 模拟处理流程
   */
  private async simulateProcessing(jobId: string, context: JobContext): Promise<void> {
    const steps = [
      { name: '初始化', weight: 10 },
      { name: '读取文档', weight: 20 },
      { name: '解析内容', weight: 40 },
      { name: '验证结果', weight: 20 },
      { name: '保存数据', weight: 10 }
    ];

    let currentProgress = 0;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) {
        throw new Error(`步骤未定义: index=${i}`);
      }
      
      // 检查是否被取消
      if (context.cancelled) {
        throw new Error('作业已被取消');
      }
      
      console.log(`🔄 ${jobId}: ${step.name}...`);
      
      // 更新进度
      currentProgress += step.weight;
      await this.updateProgress(jobId, {
        current: currentProgress,
        total: 100,
        message: `正在${step.name}...`,
        details: {
          step: i + 1,
          totalSteps: steps.length,
          stepName: step.name,
          timestamp: new Date().toISOString()
        }
      });
      
      // 模拟处理时间（随机延迟）
      const processingTime = Math.random() * 2000 + 500; // 0.5-2.5秒
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // 随机模拟错误（10%概率）
      if (Math.random() < 0.1 && step.name === '解析内容') {
        throw new Error(`模拟错误：${step.name}失败`);
      }
    }
  }

  /**
   * 生成测试数据
   */
  private generateTestData(): any {
    return {
      randomId: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      testResults: {
        parsing: 'success',
        validation: 'passed',
        performance: {
          score: Math.floor(Math.random() * 100) + 1,
          rating: 'good'
        }
      },
      metrics: {
        itemsProcessed: Math.floor(Math.random() * 1000) + 100,
        errorsFound: Math.floor(Math.random() * 5),
        warningsFound: Math.floor(Math.random() * 10)
      }
    };
  }

  /**
   * 获取当前内存使用量
   */
  private getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed; // 返回堆内存使用量
  }

  // 睡眠函数已在simulateProcessing中直接实现，无需额外定义
}