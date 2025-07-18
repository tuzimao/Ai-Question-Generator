// src/server.ts

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
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);

// 现在导入其他模块
import ServerConfig from '@/config/server';
import Database from '@/utils/database';
import { vectorService } from '@/services/VectorService';
import { aiService } from '@/services/AIService';
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
      
      // 初始化AI服务
      await this.initializeAIServices();
      
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
      console.log(`🔍 向量数据库: ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
      
      // 显示健康检查地址
      console.log(`🏥 健康检查: http://${host}:${port}/health`);
      console.log(`🔬 详细状态: http://${host}:${port}/health/detailed`);
      
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

    // AI服务相关的环境变量（警告级别）
    const recommendedEnvVars = [
      'OPENAI_API_KEY',
      'QDRANT_URL'
    ];

    // 检查必需的环境变量
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

    // 检查推荐的环境变量
    const missingRecommended = recommendedEnvVars.filter(varName => {
      const value = process.env[varName];
      return !value || value.trim() === '';
    });

    if (missingRecommended.length > 0) {
      console.warn('⚠️ 缺少推荐的环境变量（AI功能可能受限）:');
      missingRecommended.forEach(varName => {
        console.warn(`   - ${varName}: ${process.env[varName] || '未设置'}`);
      });
      console.warn('💡 建议配置这些变量以启用完整功能');
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
   * 初始化AI服务
   */
  private async initializeAIServices(): Promise<void> {
    try {
      console.log('🤖 初始化AI服务...');
      
      // 初始化向量服务
      try {
        await vectorService.initialize();
        console.log('✅ Qdrant向量服务初始化完成');
      } catch (error) {
        console.warn('⚠️ Qdrant向量服务初始化失败:', error.message);
        console.warn('💡 请确保Qdrant容器正在运行: docker-compose up qdrant');
      }
      
      // 验证AI服务
      try {
        const aiHealthy = await aiService.healthCheck();
        if (!aiHealthy) {
          console.warn('⚠️ OpenAI API连接失败，请检查API密钥');
          console.warn('💡 AI问答功能将不可用，但其他功能正常');
        } else {
          console.log('✅ OpenAI API连接正常');
        }
      } catch (error) {
        console.warn('⚠️ OpenAI API初始化失败:', error.message);
      }
      
      console.log('✅ AI服务初始化完成');
    } catch (error) {
      console.error('❌ AI服务初始化失败:', error);
      // 不抛出错误，允许应用在没有AI服务的情况下启动
      console.warn('💡 应用将在降级模式下运行（无AI功能）');
    }
  }

  /**
   * 注册路由
   */
  private async registerRoutes(): Promise<void> {
    const server = this.serverConfig.getServer();

    try {
      // 增强版健康检查路由
      server.get('/health', async (request, reply) => {
        const startTime = Date.now();
        
        // 检查各个服务的健康状态
        const [dbHealth, vectorHealth, aiHealth] = await Promise.allSettled([
          Database.healthCheck(),
          vectorService.healthCheck(),
          aiService.healthCheck()
        ]);

        const dbInfo = await Database.getInfo();
        const responseTime = Date.now() - startTime;

        // 构建健康状态响应
        const healthStatus = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          uptime: Math.floor(process.uptime()),
          responseTime: `${responseTime}ms`,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
          },
          services: {
            database: {
              status: dbHealth.status === 'fulfilled' && dbHealth.value.status === 'healthy' ? 'healthy' : 'unhealthy',
              message: dbHealth.status === 'fulfilled' ? dbHealth.value.message : 'Connection failed',
              info: dbInfo
            },
            vector: {
              status: vectorHealth.status === 'fulfilled' && vectorHealth.value ? 'healthy' : 'unhealthy',
              message: vectorHealth.status === 'fulfilled' ? 'Qdrant连接正常' : 'Qdrant连接失败',
              connected: vectorService.isConnectedToQdrant(),
              url: process.env.QDRANT_URL || 'http://localhost:6333'
            },
            ai: {
              status: aiHealth.status === 'fulfilled' && aiHealth.value ? 'healthy' : 'unhealthy',
              message: aiHealth.status === 'fulfilled' ? 'OpenAI API连接正常' : 'OpenAI API连接失败',
              models: {
                embedding: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
                chat: process.env.OPENAI_MODEL || 'gpt-4'
              }
            }
          }
        };

        // 确定整体健康状态
        const allServicesHealthy = Object.values(healthStatus.services)
          .every(service => service.status === 'healthy');
        
        healthStatus.status = allServicesHealthy ? 'healthy' : 'degraded';
        
        const statusCode = allServicesHealthy ? 200 : 503;
        reply.status(statusCode).send(healthStatus);
      });

      // 详细服务状态检查路由
      server.get('/health/detailed', async (request, reply) => {
        try {
          // 执行更详细的健康检查
          let vectorInfo = null;
          let availableModels: string[] = [];

          try {
            if (vectorService.isConnectedToQdrant()) {
              vectorInfo = await vectorService.getCollectionInfo();
            }
          } catch (error) {
            console.warn('获取向量集合信息失败:', error.message);
          }

          try {
            availableModels = await aiService.getAvailableModels();
          } catch (error) {
            console.warn('获取AI模型列表失败:', error.message);
          }
          
          const detailedStatus = {
            timestamp: new Date().toISOString(),
            services: {
              database: await Database.healthCheck(),
              vector: {
                healthy: await vectorService.healthCheck(),
                connected: vectorService.isConnectedToQdrant(),
                collection: vectorInfo,
                url: process.env.QDRANT_URL || 'http://localhost:6333'
              },
              ai: {
                healthy: await aiService.healthCheck(),
                apiKeyValid: await aiService.validateApiKey(),
                availableModels: availableModels.slice(0, 10), // 只显示前10个模型
                defaultModels: {
                  embedding: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
                  chat: process.env.OPENAI_MODEL || 'gpt-4'
                }
              }
            },
            environment: {
              nodeVersion: process.version,
              platform: process.platform,
              arch: process.arch,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
          };

          reply.send(detailedStatus);
        } catch (error) {
          console.error('详细健康检查失败:', error);
          reply.status(500).send({
            success: false,
            error: '详细健康检查失败',
            message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });

      // 服务初始化状态检查
      server.get('/health/init', async (request, reply) => {
        const initStatus = {
          timestamp: new Date().toISOString(),
          initialization: {
            database: Database.isConnectedToDatabase(),
            vector: vectorService.isConnectedToQdrant(),
            ai: await aiService.validateApiKey()
          }
        };

        const allInitialized = Object.values(initStatus.initialization).every(Boolean);
        
        reply.status(allInitialized ? 200 : 503).send({
          ...initStatus,
          ready: allInitialized,
          message: allInitialized ? '所有服务已就绪' : '部分服务未就绪'
        });
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
              '文档向量化存储',
              'AI知识问答',
              '智能题目生成',
              'RESTful API接口'
            ],
            endpoints: {
              health: '/health',
              health_detailed: '/health/detailed',
              health_init: '/health/init',
              api_info: '/api/info',
              docs: process.env.API_DOCS_ENABLED === 'true' ? '/docs' : null
            },
            services: {
              database: 'MySQL + Knex ORM',
              vector: 'Qdrant Vector Database',
              ai: 'OpenAI GPT-4 + Embeddings',
              cache: 'Redis (计划中)',
              storage: 'MinIO Object Storage (计划中)'
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

      console.log('✅ 路由注册完成（包含AI服务集成）');
      
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

      // 关闭AI服务
      try {
        await vectorService.close();
        aiService.cleanup();
        console.log('✅ AI服务已关闭');
      } catch (error) {
        console.warn('⚠️ AI服务关闭时出现警告:', error.message);
      }

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