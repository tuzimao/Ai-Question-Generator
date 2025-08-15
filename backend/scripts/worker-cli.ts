// scripts/worker-cli.ts - 修复环境变量加载问题

// 🔧 关键修复：确保环境变量在最开始就被加载
import { config } from 'dotenv';
import { resolve } from 'path';

// 🔧 明确指定 .env 文件路径
const envPath = resolve(__dirname, '../.env');
console.log('🔍 尝试加载环境变量文件:', envPath);

const envResult = config({ path: envPath });
if (envResult.error) {
  console.error('❌ 加载 .env 文件失败:', envResult.error.message);
  console.log('💡 请确保 .env 文件位于:', envPath);
} else {
  console.log('✅ .env 文件加载成功');
}

// 🔧 调试：显示加载的环境变量
console.log('🔍 环境变量加载检查:');
console.log('  DB_HOST:', process.env.DB_HOST || '❌ 未设置');
console.log('  DB_USER:', process.env.DB_USER || '❌ 未设置');
console.log('  DB_NAME:', process.env.DB_NAME || '❌ 未设置');
console.log('  DB_PORT:', process.env.DB_PORT || '❌ 未设置');
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD !== undefined ? '✅ 已设置' : '❌ 未设置');

import { workerBootstrap } from '../src/workers/WorkerBootstrap';
import { WorkerConfiguration } from '../src/config/worker';

/**
 * Worker命令行工具
 * 提供Worker管理的各种命令
 */
class WorkerCLI {
  /**
   * 显示Worker状态
   */
  public static async status(): Promise<void> {
    try {
      console.log('📊 获取Worker系统状态...');
      
      // 快速初始化
      await workerBootstrap.initialize();
      
      const health = await workerBootstrap.getSystemHealth();
      
      console.log('📊 Worker系统状态报告');
      console.log('='.repeat(50));
      console.log(`🌍 系统状态: ${this.getStatusEmoji(health.status)} ${health.status.toUpperCase()}`);
      console.log(`⏰ 检查时间: ${health.timestamp.toLocaleString()}`);
      console.log();

      // Worker状态
      console.log('👷 Worker状态:');
      if (health.workers.length === 0) {
        console.log('  📭 没有注册的Worker');
      } else {
        health.workers.forEach(worker => {
          const statusEmoji = this.getWorkerStatusEmoji(worker.state);
          console.log(`  ${statusEmoji} ${worker.name}`);
          console.log(`     状态: ${worker.state}`);
          console.log(`     处理: ${worker.processedJobs} 个作业`);
          console.log(`     成功率: ${(worker.errorRate > 0 ? (1 - worker.errorRate) * 100 : 100).toFixed(1)}%`);
          console.log(`     活跃: ${worker.activeJobs} 个作业`);
          if (worker.averageProcessingTime > 0) {
            console.log(`     平均处理时间: ${worker.averageProcessingTime.toFixed(0)}ms`);
          }
          console.log();
        });
      }

      // 队列状态
      console.log('📋 队列状态:');
      if (health.queues.length === 0) {
        console.log('  📭 没有队列数据');
      } else {
        health.queues.forEach(queue => {
          const total = queue.pending + queue.active + queue.completed + queue.failed;
          console.log(`  📝 ${queue.name}`);
          console.log(`     等待: ${queue.pending} | 处理中: ${queue.active} | 完成: ${queue.completed} | 失败: ${queue.failed}`);
          console.log(`     总计: ${total} 个作业`);
          console.log();
        });
      }

      // 系统负载
      console.log('💻 系统负载:');
      console.log(`  CPU: ${(health.systemLoad.cpu * 100).toFixed(1)}%`);
      console.log(`  内存: ${(health.systemLoad.memory * 100).toFixed(1)}%`);
      console.log(`  磁盘: ${(health.systemLoad.disk * 100).toFixed(1)}%`);

    } catch (error) {
      console.error('❌ 获取状态失败:', error);
      process.exit(1);
    }
  }

  /**
   * 显示Worker配置
   */
  public static async config(): Promise<void> {
    console.log('⚙️ Worker配置信息');
    console.log('='.repeat(50));
    
    try {
      const configs = WorkerConfiguration.getAllConfigs();
      
      configs.forEach(config => {
        console.log(`📝 ${config.name}`);
        console.log(`   队列: ${config.queueName}`);
        console.log(`   并发: ${config.concurrency}`);
        console.log(`   轮询间隔: ${config.pollInterval}ms`);
        console.log(`   超时: ${config.timeout}ms`);
        console.log(`   最大重试: ${config.maxRetries}`);
        console.log(`   启用: ${config.enabled ? '✅' : '❌'}`);
        console.log();
      });
    } catch (error) {
      console.error('❌ 获取配置失败:', error);
      process.exit(1);
    }
  }

  /**
   * 清理作业
   */
  public static async cleanup(): Promise<void> {
    try {
      console.log('🧹 开始清理作业...');
      
      await workerBootstrap.initialize();
      
      const ProcessingJobModel = (await import('../src/models/ProcessingJob')).default;
      
      // 重置超时作业
      const resetCount = await ProcessingJobModel.resetTimeoutJobs(30);
      console.log(`⚠️ 重置 ${resetCount} 个超时作业`);
      
      // 清理旧作业
      const cleaned = await ProcessingJobModel.cleanupOldJobs(168, 720);
      console.log(`🗑️ 清理 ${cleaned.completed} 个已完成作业`);
      console.log(`🗑️ 清理 ${cleaned.failed} 个失败作业`);
      
      console.log('✅ 清理完成');
      
    } catch (error) {
      console.error('❌ 清理失败:', error);
      process.exit(1);
    }
  }

  /**
   * 测试Worker连接
   */
  public static async test(): Promise<void> {
    try {
      console.log('🔧 测试Worker系统...');
      
      // 🔧 首先显示环境变量状态
      console.log('\n📋 环境变量检查:');
      console.log('='.repeat(30));
      console.log(`DB_HOST: ${process.env.DB_HOST || '❌ 未设置'}`);
      console.log(`DB_USER: ${process.env.DB_USER || '❌ 未设置'}`);
      console.log(`DB_NAME: ${process.env.DB_NAME || '❌ 未设置'}`);
      console.log(`DB_PORT: ${process.env.DB_PORT || '❌ 未设置'}`);
      console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD !== undefined ? '✅ 已设置' : '❌ 未设置'}`);
      
      // 如果环境变量没设置，提供帮助
      if (!process.env.DB_HOST) {
        console.log('\n❌ 环境变量未加载，可能的原因:');
        console.log('1. .env 文件不存在或位置错误');
        console.log('2. .env 文件格式错误');
        console.log('3. 文件权限问题');
        
        console.log('\n💡 解决步骤:');
        console.log('1. 确认 .env 文件在 backend 目录下：ls -la backend/.env');
        console.log('2. 检查文件内容：cat backend/.env');
        console.log('3. 确保格式正确：DB_HOST=127.0.0.1 (等号两边无空格)');
        
        throw new Error('环境变量未加载');
      }
      
      // 测试数据库连接
      const { Database } = await import('../src/utils/database');
      console.log('\n📊 测试数据库连接...');
      await Database.initialize();
      
      const health = await Database.healthCheck();
      console.log(`📊 数据库: ${health.status === 'healthy' ? '✅' : '❌'} ${health.message}`);
      
      // 测试Worker配置
      const configs = WorkerConfiguration.getAllConfigs();
      console.log(`⚙️ 配置: ✅ 找到 ${configs.length} 个Worker配置`);
      
      configs.forEach(config => {
        const valid = WorkerConfiguration.validateConfig(config);
        console.log(`   ${config.name}: ${valid ? '✅' : '❌'}`);
      });
      
      // 测试Worker创建
      console.log('🛠️ 测试Worker创建...');
      const { WorkerRegistry } = await import('../src/workers/WorkerRegistry');
      const workers = WorkerRegistry.createAllWorkers();
      console.log(`👷 Worker创建: ✅ 成功创建 ${workers.length} 个Worker实例`);
      
      // 测试Worker系统初始化
      console.log('🔧 测试Worker系统初始化...');
      await workerBootstrap.initialize();
      console.log('🔧 初始化: ✅ Worker系统初始化成功');
      
      console.log('✅ 所有测试通过');
      
    } catch (error) {
      console.error('❌ 测试失败:', error);
      console.error('错误详情:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('堆栈信息:', error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * 获取状态表情符号
   */
  private static getStatusEmoji(status: string): string {
    switch (status) {
      case 'healthy': return '💚';
      case 'degraded': return '💛';
      case 'unhealthy': return '❤️';
      default: return '❓';
    }
  }

  /**
   * 获取Worker状态表情符号
   */
  private static getWorkerStatusEmoji(state: string): string {
    switch (state) {
      case 'running': return '🟢';
      case 'stopped': return '🔴';
      case 'stopping': return '🟡';
      case 'error': return '💥';
      default: return '⚪';
    }
  }
}

/**
 * 启动Worker服务的函数
 */
async function startWorkerService() {
  try {
    console.log('🚀 启动AI问答系统Worker服务...');
    console.log('📅 启动时间:', new Date().toISOString());
    console.log('🌍 环境:', process.env.NODE_ENV || 'development');

    // 初始化Worker系统
    await workerBootstrap.initialize();

    // 启动所有Worker
    await workerBootstrap.startWorkers();

    console.log('✅ Worker服务启动成功!');
    console.log('📊 使用 npm run worker:status 查看状态');
    console.log('🛑 使用 Ctrl+C 优雅停止服务');

    // 保持进程运行
    process.on('SIGINT', async () => {
      console.log('\n📢 接收到停止信号，开始优雅关闭...');
      await workerBootstrap.stopWorkers();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Worker服务启动失败:', error);
    process.exit(1);
  }
}

/**
 * 命令行入口
 */
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'start':
        await startWorkerService();
        break;
      case 'status':
        await WorkerCLI.status();
        break;
      case 'config':
        await WorkerCLI.config();
        break;
      case 'cleanup':
        await WorkerCLI.cleanup();
        break;
      case 'test':
        await WorkerCLI.test();
        break;
      default:
        console.log('🤖 AI问答系统 Worker管理工具');
        console.log();
        console.log('可用命令:');
        console.log('  npm run worker:start   - 启动Worker服务');
        console.log('  npm run worker:status  - 查看Worker状态');
        console.log('  npm run worker:config  - 查看Worker配置');
        console.log('  npm run worker:cleanup - 清理旧作业');
        console.log('  npm run worker:test    - 测试Worker系统');
        break;
    }
  } catch (error) {
    console.error('❌ 命令执行失败:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 程序执行失败:', error);
    process.exit(1);
  });
}