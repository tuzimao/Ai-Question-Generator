// knexfile.ts (修复版)
// Knex CLI工具的配置文件，用于数据库迁移和种子数据

import dotenv from 'dotenv';
import { DatabaseConfig } from './src/config/database';

// 加载环境变量
dotenv.config();

/**
 * Knex CLI配置
 * 修复迁移目录配置，确保开发和构建环境一致
 */
const config = {
  development: {
    ...DatabaseConfig.getConfig(),
    migrations: {
      // 开发环境：直接使用编译后的JS文件
      directory: './dist/migrations',
      tableName: 'knex_migrations',
      extension: 'js' // 重要：指定为js扩展名
    },
    seeds: {
      directory: './dist/seeds',
      extension: 'js'
    }
  },
  
  // 测试环境配置
  test: {
    ...DatabaseConfig.getConfig(),
    connection: {
      ...(DatabaseConfig.getConfig().connection as object),
      database: `${process.env.DB_NAME || 'ai_question_generator'}_test`
    },
    migrations: {
      directory: './dist/migrations',
      tableName: 'knex_migrations',
      extension: 'js'
    }
  },
  
  // 生产环境配置
  production: {
    ...DatabaseConfig.getConfig(),
    connection: {
      ...(DatabaseConfig.getConfig().connection as object),
      database: `${process.env.DB_NAME || 'ai_question_generator'}_production`
    },
    migrations: {
      directory: './dist/migrations',
      tableName: 'knex_migrations',
      extension: 'js'
    }
  }
};

export default config;