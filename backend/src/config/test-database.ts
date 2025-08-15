// backend/src/config/test-database.ts
import { Knex } from 'knex';

/**
 * 测试数据库配置
 */
export class TestDatabaseConfig {
  /**
   * 获取测试数据库配置
   */
  static getConfig(): Knex.Config {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('TestDatabaseConfig 只能在测试环境中使用');
    }

    return {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_question_generator_test',
        charset: 'utf8mb4',
        multipleStatements: true  // 允许执行多条SQL（用于truncate等操作）
      },
      pool: {
        min: 1,
        max: 5  // 测试环境减少连接数
      },
      migrations: {
        directory: './src/migrations',
        tableName: 'knex_migrations',
        extension: 'ts'
      },
      seeds: {
        directory: './src/seeds',
        extension: 'ts'
      },
      debug: process.env.DEBUG_SQL === 'true',  // 通过环境变量控制SQL调试
      acquireConnectionTimeout: 60000  // 获取连接超时时间
    };
  }

  /**
   * 验证测试数据库名称
   * 确保不会误操作生产数据库
   */
  static validateTestDatabase(): boolean {
    const dbName = process.env.DB_NAME || '';
    
    if (!dbName.includes('test')) {
      console.error('❌ 警告：测试数据库名称应包含 "test" 字样');
      console.error(`当前数据库名称: ${dbName}`);
      return false;
    }

    // 禁止使用生产数据库名称
    const productionNames = ['ai_question_generator', 'production', 'prod'];
    if (productionNames.some(name => dbName === name)) {
      console.error('❌ 错误：不能使用生产数据库进行测试！');
      return false;
    }

    return true;
  }

  /**
   * 获取测试数据库连接字符串（用于日志）
   */
  static getConnectionString(): string {
    const config = this.getConfig();
    const conn = config.connection as any;
    return `mysql://${conn.user}:****@${conn.host}:${conn.port}/${conn.database}`;
  }
}