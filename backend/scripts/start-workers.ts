// scripts/start-workers.ts - Worker启动脚本

import { workerBootstrap } from '../src/workers/WorkerBootstrap';

/**
 * Worker服务启动脚本
 * 用于独立启动Worker进程
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

    process.on('SIGTERM', async () => {
      console.log('\n📢 接收到终止信号，开始优雅关闭...');
      await workerBootstrap.stopWorkers();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Worker服务启动失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      if (error.stack) {
        console.error('堆栈信息:', error.stack);
      }
    }
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  startWorkerService();
}

export { startWorkerService };