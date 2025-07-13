// src/config/server.ts

import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { RequestContext, User } from '@/types/base';

/**
 * Fastify服务器配置类
 * 负责创建和配置Fastify服务器实例
 */
export class ServerConfig {
  private server: FastifyInstance;

  constructor() {
    this.server = this.createServer();
  }

  /**
   * 创建Fastify服务器实例
   * @returns 配置好的Fastify实例
   */
  private createServer(): FastifyInstance {
    // 日志配置
    const logger =
      process.env.NODE_ENV === 'development'
        ? {
            level: process.env.LOG_LEVEL || 'info',
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
              }
            }
          }
        : { level: process.env.LOG_LEVEL || 'info' };

    const serverOptions: FastifyServerOptions = {
      logger,
      genReqId: () => uuidv4(),
      bodyLimit: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10) // 50MB
    };

    const server = Fastify(serverOptions);

    // 注册插件
    this.registerPlugins(server)
      .then(() => console.log('✅ 所有插件注册成功'))
      .catch((error) => {
        console.error('❌ 插件注册失败:', error);
        throw error;
      });

    // 添加钩子
    this.addHooks(server);

    return server;
  }

  /**
   * 注册Fastify插件
   * @param server Fastify实例
   */
  private async registerPlugins(server: FastifyInstance): Promise<void> {
    await server.register(cors, {
      origin: this.getCorsOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    });

    await server.register(jwt, {
      secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
      sign: {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      },
      verify: {
        maxAge: process.env.JWT_EXPIRES_IN || '7d'
      }
    });

    await server.register(multipart, {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
        files: 10
      },
      attachFieldsToBody: false
    });

    await server.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      timeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000', 10),
      errorResponseBuilder: (req, context) => ({
        success: false,
        error: '请求过于频繁，请稍后再试',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        timestamp: new Date().toISOString()
      })
    });
  }

  /**
   * 添加请求钩子
   * @param server Fastify实例
   */
  private addHooks(server: FastifyInstance): void {
    // 请求前钩子 - 添加自定义请求上下文
    server.addHook('preHandler', async (request, reply) => {
      const context: RequestContext = {
        requestId: request.id,
        timestamp: new Date()
      };
      request.appContext = context;
    });

    // 请求后钩子 - 添加响应头
    server.addHook('onSend', async (request, reply, payload) => {
      reply.header('X-Request-ID', request.id);
      reply.header('X-Response-Time', Date.now() - request.appContext.timestamp.getTime() + 'ms');
      return payload;
    });

    // 错误处理钩子
    server.setErrorHandler(async (error, request, reply) => {
      const requestId = request.id;
      request.log.error({
        error: error.message,
        stack: error.stack,
        requestId,
        url: request.url,
        method: request.method
      });

      const statusCode = this.getErrorStatusCode(error);

      const errorResponse = {
        success: false,
        error: this.getErrorMessage(error, statusCode),
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
        requestId
      };

      reply.status(statusCode).send(errorResponse);
    });

    console.log('✅ 请求钩子配置完成');
  }

  /**
   * 获取CORS允许的源
   * @returns CORS源数组
   */
  private getCorsOrigins(): string[] {
    const origins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000';
    return origins.split(',').map(origin => origin.trim());
  }

  /**
   * 根据错误类型获取HTTP状态码
   */
  private getErrorStatusCode(error: any): number {
    if (error.statusCode) return error.statusCode;
    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') return 401;
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') return 401;
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') return 401;
    if (error.validation) return 400;
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') return 503;
    return 500;
  }

  /**
   * 获取用户友好的错误消息
   */
  private getErrorMessage(error: any, statusCode: number): string {
    switch (statusCode) {
      case 400:
        return '请求参数错误';
      case 401:
        return '身份验证失败';
      case 403:
        return '权限不足';
      case 404:
        return '资源未找到';
      case 409:
        return '资源冲突';
      case 429:
        return '请求过于频繁';
      case 500:
        return '服务器内部错误';
      case 503:
        return '服务暂时不可用';
      default:
        return '未知错误';
    }
  }

  /**
   * 获取服务器实例
   */
  public getServer(): FastifyInstance {
    return this.server;
  }

  /**
   * 启动服务器
   */
  public async start(port: number = 8000, host: string = '0.0.0.0'): Promise<void> {
    try {
      await this.server.listen({ port, host });
      console.log(`🚀 服务器启动成功: http://${host}:${port}`);
    } catch (error) {
      console.error('❌ 服务器启动失败:', error);
      process.exit(1);
    }
  }

  /**
   * 优雅关闭服务器
   */
  public async stop(): Promise<void> {
    try {
      await this.server.close();
      console.log('✅ 服务器已优雅关闭');
    } catch (error) {
      console.error('❌ 服务器关闭失败:', error);
    }
  }
}

// 👇 扩展 FastifyRequest，避免冲突 Fastify 内建 context 类型
declare module 'fastify' {
  interface FastifyRequest {
    appContext: RequestContext;
    appUser?: User;
  }
}

export default ServerConfig;