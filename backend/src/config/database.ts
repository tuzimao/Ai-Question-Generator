// src/config/database.ts

import { Knex } from 'knex';
import path from 'path';

/**
 * 数据库配置管理类
 * 负责管理不同环境下的数据库连接配置
 */
export class DatabaseConfig {
  /**
   * 获取当前环境的数据库配置
   * @returns Knex配置对象
   */
  static getConfig(): Knex.Config {
    const env = process.env.NODE_ENV || 'development';
    
    // 基础连接配置
    const baseConfig: Knex.Config = {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_question_generator',
        charset: 'utf8mb4', // 支持emoji和特殊字符
        timezone: '+08:00' // 设置时区为北京时间
      },
      pool: {
        min: 2,  // 最小连接数
        max: 10, // 最大连接数
        acquireTimeoutMillis: 30000, // 获取连接超时时间
        createTimeoutMillis: 30000,  // 创建连接超时时间
        destroyTimeoutMillis: 5000,  // 销毁连接超时时间
        idleTimeoutMillis: 30000     // 空闲连接超时时间
      },
      migrations: {
        directory: path.join(__dirname, '../migrations'),
        tableName: 'knex_migrations',
        extension: 'ts'
      },
      seeds: {
        directory: path.join(__dirname, '../seeds'),
        extension: 'ts'
      },
      // 启用查询调试(开发环境)
      debug: env === 'development' && process.env.DEBUG_MODE === 'true'
    };

    // 根据环境调整配置
    switch (env) {
      case 'development':
        return {
          ...baseConfig,
          // 开发环境特殊配置
          debug: true,
          asyncStackTraces: true // 异步堆栈跟踪
        };

      case 'test':
        return {
          ...baseConfig,
          connection: {
            ...(baseConfig.connection as Knex.MySqlConnectionConfig),
            database: `${process.env.DB_NAME || 'ai_question_generator'}_test`
          },
          pool: { min: 1, max: 5 } // 测试环境减少连接数
        };

      case 'production':
        return {
          ...baseConfig,
          debug: false,
          pool: {
            min: 5,
            max: 20 // 生产环境增加连接数
          },
          connection: {
            ...(baseConfig.connection as Knex.MySqlConnectionConfig),
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
          }
        };

      default:
        return baseConfig;
    }
  }

  /**
   * 验证数据库连接配置
   * @returns 是否配置有效
   */
  static validateConfig(): boolean {
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`❌ 缺少必要的环境变量: ${envVar}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 获取连接字符串（用于日志显示）
   * @returns 脱敏后的连接字符串
   */
  static getConnectionString(): string {
    const config = this.getConfig();
    const conn = config.connection as any;
    
    return `mysql://${conn.user}:****@${conn.host}:${conn.port}/${conn.database}`;
  }
}

// 导出配置对象，供knexfile.js使用
export const databaseConfig = DatabaseConfig.getConfig();

// 默认导出配置类
export default DatabaseConfig;