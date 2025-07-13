// knexfile.ts
// Knex CLI工具的配置文件，用于数据库迁移和种子数据

import dotenv from 'dotenv';
import { DatabaseConfig } from './src/config/database';

// 加载环境变量
dotenv.config();

/**
 * Knex CLI配置
 * 
 * 使用说明:
 * - 创建迁移: npm run migrate:make create_users_table
 * - 执行迁移: npm run migrate:latest
 * - 回滚迁移: npm run migrate:rollback
 */
const config = {
  development: DatabaseConfig.getConfig(),
  
    // 测试环境配置
  test: {
    ...DatabaseConfig.getConfig(),
    connection: {
      ...(DatabaseConfig.getConfig().connection as object),
      database: `${process.env.DB_NAME || 'ai_question_generator'}_test`
    }
  },
    // 生产环境配置
  production: {
    ...DatabaseConfig.getConfig(),
    connection: {
      ...(DatabaseConfig.getConfig().connection as object),
      database: `${process.env.DB_NAME || 'ai_question_generator'}_production`
    }
  }
};

export default config;