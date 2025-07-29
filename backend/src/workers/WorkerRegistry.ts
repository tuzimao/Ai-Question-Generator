// src/workers/WorkerRegistry.ts - Worker注册表

import { BaseWorker } from './BaseWorker';
import { TestWorker } from './TestWorker';
import { WorkerConfiguration } from '@/config/worker';
import { WorkerConfig } from '@/types/worker';

/**
 * Worker注册表
 * 负责创建和管理所有Worker实例
 */
export class WorkerRegistry {
  /**
   * 创建所有配置的Worker实例
   */
  public static createAllWorkers(): BaseWorker[] {
    const workers: BaseWorker[] = [];
    
    try {
      console.log('🔧 创建Worker实例...');
      
      // 获取所有Worker配置
      const configs = WorkerConfiguration.getAllConfigs();
      
      for (const config of configs) {
        try {
          // 验证配置
          if (!WorkerConfiguration.validateConfig(config)) {
            console.warn(`⚠️ 跳过无效配置的Worker: ${config.name}`);
            continue;
          }
          
          // 检查是否启用
          if (!config.enabled) {
            console.log(`⏸️ 跳过已禁用的Worker: ${config.name}`);
            continue;
          }
          
          // 根据Worker名称创建实例
          const worker = this.createWorkerByName(config);
          if (worker) {
            workers.push(worker);
            console.log(`✅ 创建Worker: ${config.name}`);
          }
          
        } catch (error) {
          console.error(`❌ 创建Worker失败: ${config.name}`, error);
        }
      }
      
      console.log(`🎯 成功创建 ${workers.length} 个Worker实例`);
      return workers;
      
    } catch (error) {
      console.error('❌ 创建Worker实例失败:', error);
      return [];
    }
  }
  
  /**
   * 根据名称创建特定的Worker实例
   */
  public static createWorkerByName(config: WorkerConfig): BaseWorker | null {
    switch (config.name) {
      case 'document-parser':
        // TODO: 实现文档解析Worker
        return this.createTestWorker({
          ...config,
          name: 'document-parser-test'
        });
        
      case 'document-chunker':
        // TODO: 实现文档分块Worker
        return this.createTestWorker({
          ...config,
          name: 'document-chunker-test'
        });
        
      case 'system-cleanup':
        // TODO: 实现系统清理Worker
        return this.createTestWorker({
          ...config,
          name: 'system-cleanup-test'
        });
        
      default:
        console.warn(`⚠️ 未知的Worker类型: ${config.name}`);
        return null;
    }
  }
  
  /**
   * 创建测试Worker实例
   */
  public static createTestWorker(config: WorkerConfig): TestWorker {
    return new TestWorker(config);
  }
  
  /**
   * 创建文档解析Worker（占位符）
   */
  public static createDocumentParseWorker(config: WorkerConfig): BaseWorker {
    // 临时使用TestWorker，后续实现真正的DocumentParseWorker
    return new TestWorker({
      ...config,
      name: config.name + '-placeholder'
    });
  }
  
  /**
   * 创建文档分块Worker（占位符）
   */
  public static createDocumentChunkWorker(config: WorkerConfig): BaseWorker {
    // 临时使用TestWorker，后续实现真正的DocumentChunkWorker
    return new TestWorker({
      ...config,
      name: config.name + '-placeholder'
    });
  }
  
  /**
   * 创建清理Worker（占位符）
   */
  public static createCleanupWorker(config: WorkerConfig): BaseWorker {
    // 临时使用TestWorker，后续实现真正的CleanupWorker
    return new TestWorker({
      ...config,
      name: config.name + '-placeholder'
    });
  }
  
  /**
   * 获取所有可用的Worker类型
   */
  public static getAvailableWorkerTypes(): string[] {
    return [
      'document-parser',
      'document-chunker', 
      'system-cleanup'
    ];
  }
  
  /**
   * 检查Worker类型是否支持
   */
  public static isWorkerTypeSupported(workerType: string): boolean {
    return this.getAvailableWorkerTypes().includes(workerType);
  }
}