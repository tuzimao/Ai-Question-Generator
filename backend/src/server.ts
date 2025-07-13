// src/server.ts (修复版本)

// ⚠️ 重要：必须在所有其他导入之前加载环境变量
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量（在导入其他模块之前）
dotenv.config({ path: path.join(__dirname, '../.env') });

// 验证关键环境变量是否加载
console.log('🔧 环境变量加载检查:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);

// 现在导入其他模块
import ServerConfig from '@/config/server';
import Database from '@/utils/database';
import { BaseResponse } from '@/types/base';

/**
 * 应用程序主类
 * 负责启动和管理整个应用程序
 */
class App {
  private serverConfig: ServerConfig;
  private isShuttingDown: boolean = false;

  constructor() {
    this.serverConfig = new ServerConfig();
    this.setupGlobalErrorHandlers();
  }

  /**
   * 启动应用程序
   */
  public async start(): Promise<void> {
    try {
      console.log('🚀 正在启动AI题目生成器后端服务...');
      
      // 验证环境变量
      this.validateEnvironment();
      
      // 初始化数据库
      await this.initializeDatabase();
      
      // 注册路由
      await this.registerRoutes();
      
      // 启动服务器
      const port = parseInt(process.env.PORT || '8000', 10);
      const host = process.env.HOST || '0.0.0.0';
      
      await this.serverConfig.start(port, host);
      
      console.log('✅ 应用程序启动完成');
      console.log(`📍 API服务地址: http://${host}:${port}`);
      console.log(`🌐 前端地址: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`📊 数据库: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
      
      // 显示API文档地址（如果启用）
      if (process.env.API_DOCS_ENABLED === 'true') {
        console.log(`📚 API文档: http://${host}:${port}/docs`);
      }
      
    } catch (error) {
      console.error('❌ 应用程序启动失败:', error);
      process.exit(1);
    }
  }

  /**
   * 验证必要的环境变量
   */
  private validateEnvironment(): void {
    const requiredEnvVars = [
      'DB_HOST',
      'DB_USER', 
      'DB_NAME',
      'JWT_SECRET'
    ];

    const missingVars = requiredEnvVars.filter(varName => {
      const value = process.env[varName];
      return !value || value.trim() === '';
    });
    
    if (missingVars.length > 0) {
      console.error('❌ 缺少必要的环境变量:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}: ${process.env[varName] || '未设置'}`);
      });
      console.error('\n💡 解决方案:');
      console.error('1. 检查 .env 文件是否存在');
      console.error('2. 检查 .env 文件中是否包含所有必要变量');
      console.error('3. 确保 .env 文件在 backend 目录下');
      console.error('4. 重新启动开发服务器');
      process.exit(1);
    }

    console.log('✅ 环境变量验证通过');
  }

  /**
   * 初始化数据库
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await Database.initialize();
      
      // 执行健康检查
      const healthCheck = await Database.healthCheck();
      if (healthCheck.status === 'healthy') {
        console.log('✅ 数据库健康检查通过');
      } else {
        throw new Error(`数据库健康检查失败: ${healthCheck.message}`);
      }
      
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 注册路由
   */
  private async registerRoutes(): Promise<void> {
    const server = this.serverConfig.getServer();

    try {
      // 健康检查路由
      server.get('/health', async (request, reply) => {
        const dbHealth = await Database.healthCheck();
        const dbInfo = await Database.getInfo();
        
        const healthStatus = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          database: {
            ...dbHealth,
            info: dbInfo
          }
        };

        const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
        reply.status(statusCode).send(healthStatus);
      });

      // API信息路由
      server.get('/api/info', async (request, reply) => {
        const response: BaseResponse = {
          success: true,
          message: 'AI题目生成器API服务',
          data: {
            name: 'AI Question Generator API',
            version: process.env.npm_package_version || '1.0.0',
            description: '基于AI的智能题目生成系统后端API',
            environment: process.env.NODE_ENV || 'development',
            features: [
              '用户认证与授权',
              '题目智能生成',
              '知识库管理',
              '文件上传处理',
              'RESTful API接口'
            ],
            endpoints: {
              health: '/health',
              api_info: '/api/info',
              docs: process.env.API_DOCS_ENABLED === 'true' ? '/docs' : null
            }
          },
          timestamp: new Date().toISOString()
        };

        reply.send(response);
      });

      // 404 处理
      server.setNotFoundHandler(async (request, reply) => {
        const response: BaseResponse = {
          success: false,
          error: 'API端点未找到',
          message: `${request.method} ${request.url} 不存在`,
          timestamp: new Date().toISOString(),
          requestId: request.id
        };

        reply.status(404).send(response);
      });

      console.log('✅ 基础路由注册完成');
      
    } catch (error) {
      console.error('❌ 路由注册失败:', error);
      throw error;
    }
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    // 处理未捕获的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ 未处理的Promise拒绝:', reason);
      console.error('Promise:', promise);
      
      if (!this.isShuttingDown) {
        this.gracefulShutdown('UNHANDLED_PROMISE_REJECTION');
      }
    });

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('❌ 未捕获的异常:', error);
      
      if (!this.isShuttingDown) {
        this.gracefulShutdown('UNCAUGHT_EXCEPTION');
      }
    });

    // 处理进程信号
    process.on('SIGTERM', () => {
      console.log('📡 收到SIGTERM信号，准备优雅关闭...');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      console.log('📡 收到SIGINT信号，准备优雅关闭...');
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * 优雅关闭应用程序
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log('⏳ 关闭进程已在进行中...');
      return;
    }

    this.isShuttingDown = true;
    console.log(`🔄 开始优雅关闭应用程序 (信号: ${signal})`);

    try {
      // 设置关闭超时
      const shutdownTimeout = setTimeout(() => {
        console.error('❌ 优雅关闭超时，强制退出');
        process.exit(1);
      }, 30000); // 30秒超时

      // 停止接受新请求并关闭服务器
      await this.serverConfig.stop();

      // 关闭数据库连接
      await Database.close();

      // 清除超时器
      clearTimeout(shutdownTimeout);

      console.log('✅ 应用程序已优雅关闭');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ 优雅关闭过程中发生错误:', error);
      process.exit(1);
    }
  }
}

/**
 * 应用程序入口点
 */
async function main(): Promise<void> {
  const app = new App();
  await app.start();
}

// 启动应用程序
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 应用程序启动失败:', error);
    process.exit(1);
  });
}

// 导出App类供测试使用
export default App;