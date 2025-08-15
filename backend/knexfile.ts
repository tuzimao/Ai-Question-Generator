import path from 'path';
import dotenv from 'dotenv';
import { DatabaseConfig } from './src/config/database';

dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// 根据环境确定迁移文件路径和扩展名
const getMigrationsConfig = () => {
  if (isDevelopment) {
    return {
      directory: path.resolve(__dirname, 'src/migrations'),
      tableName: 'knex_migrations',
      extension: 'ts'
    };
  } else {
    return {
      directory: path.resolve(__dirname, 'dist/migrations'),
      tableName: 'knex_migrations', 
      extension: 'js'
    };
  }
};

const getSeedsConfig = () => {
  if (isDevelopment) {
    return {
      directory: path.resolve(__dirname, 'src/seeds'),
      extension: 'ts'
    };
  } else {
    return {
      directory: path.resolve(__dirname, 'dist/seeds'),
      extension: 'js'
    };
  }
};

const config = {
  development: {
    ...DatabaseConfig.getConfig(),
    migrations: getMigrationsConfig(),
    seeds: getSeedsConfig()
  },
  test: {
    ...DatabaseConfig.getConfig(),
    connection: {
      ...(DatabaseConfig.getConfig().connection as object),
      database: `${process.env.DB_NAME || 'ai_question_generator'}_test`
    },
    migrations: getMigrationsConfig()
  },
  production: {
    ...DatabaseConfig.getConfig(),
    connection: {
      ...(DatabaseConfig.getConfig().connection as object),
      database: `${process.env.DB_NAME || 'ai_question_generator'}_production`
    },
    migrations: getMigrationsConfig(),
    seeds: getSeedsConfig()
  }
};

export default config;