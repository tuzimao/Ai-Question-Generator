import path from 'path';
import dotenv from 'dotenv';
import { DatabaseConfig } from './src/config/database';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(__dirname, 'dist/migrations');
const SEEDS_DIR = path.resolve(__dirname, 'dist/seeds');

const config = {
  development: {
    ...DatabaseConfig.getConfig(),
    migrations: {
      directory: MIGRATIONS_DIR,
      tableName: 'knex_migrations',
      extension: 'js'
    },
    seeds: {
      directory: SEEDS_DIR,
      extension: 'js'
    }
  },
  test: {
    ...DatabaseConfig.getConfig(),
    connection: {
      ...(DatabaseConfig.getConfig().connection as object),
      database: `${process.env.DB_NAME || 'ai_question_generator'}_test`
    },
    migrations: {
      directory: MIGRATIONS_DIR,
      tableName: 'knex_migrations',
      extension: 'js'
    }
  },
  production: {
    ...DatabaseConfig.getConfig(),
    connection: {
      ...(DatabaseConfig.getConfig().connection as object),
      database: `${process.env.DB_NAME || 'ai_question_generator'}_production`
    },
    migrations: {
      directory: MIGRATIONS_DIR,
      tableName: 'knex_migrations',
      extension: 'js'
    }
  }
};

export default config;
