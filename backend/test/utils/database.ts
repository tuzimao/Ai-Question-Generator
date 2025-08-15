// backend/test/utils/database.ts
import knex, { Knex } from 'knex';
import { TestDatabaseConfig } from '../../src/config/test-database';
import { Database } from '../../src/utils/database';

export class TestDatabase {
  private static testDb: Knex | null = null;
  private static isInitialized = false;

  /**
   * 初始化测试数据库
   */
  static async initialize(): Promise<void> {
    // 确保使用测试环境
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('只能在测试环境中使用测试数据库');
    }

    // 验证测试数据库配置
    if (!TestDatabaseConfig.validateTestDatabase()) {
      throw new Error('测试数据库配置验证失败');
    }

    // 如果已经初始化，直接返回
    if (this.isInitialized && this.testDb) {
      console.log('✅ 测试数据库已经初始化');
      return;
    }

    try {
      // 创建测试数据库连接
      const config = TestDatabaseConfig.getConfig();
      this.testDb = knex(config);

      // 测试连接
      await this.testDb.raw('SELECT 1 as test');
      
      // 初始化主数据库连接（使用测试配置）
      await Database.initialize();
      
      this.isInitialized = true;
      console.log(`✅ 测试数据库连接成功: ${TestDatabaseConfig.getConnectionString()}`);
    } catch (error) {
      console.error('❌ 测试数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保数据库存在
   */
  static async ensureDatabaseExists(): Promise<void> {
    const tempDb = knex({
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
      }
    });

    try {
      const dbName = process.env.DB_NAME || 'ai_question_generator_test';
      
      // 创建数据库（如果不存在）
      await tempDb.raw(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✅ 确保测试数据库存在: ${dbName}`);
    } catch (error) {
      console.error('创建测试数据库失败:', error);
      throw error;
    } finally {
      await tempDb.destroy();
    }
  }

  /**
   * 清理所有表数据（保留结构）
   */
  static async cleanAllTables(): Promise<void> {
    if (!this.testDb) {
      throw new Error('测试数据库未初始化');
    }

    // 禁用外键检查
    await this.testDb.raw('SET FOREIGN_KEY_CHECKS = 0');

    try {
      // 获取所有表名
      const tables = await this.getAllTables();
      
      // 清理每个表（跳过migrations和seeds表）
      for (const table of tables) {
        if (!table.includes('knex_migrations') && !table.includes('knex_migrations_lock')) {
          await this.testDb.raw(`TRUNCATE TABLE \`${table}\``);
          console.log(`🧹 清理表: ${table}`);
        }
      }
    } finally {
      // 重新启用外键检查
      await this.testDb.raw('SET FOREIGN_KEY_CHECKS = 1');
    }
  }

  /**
   * 获取所有表名
   */
  static async getAllTables(): Promise<string[]> {
    if (!this.testDb) {
      throw new Error('测试数据库未初始化');
    }

    const result = await this.testDb.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      AND table_type = 'BASE TABLE'
    `);
    
    return result[0].map((row: any) => row.table_name || row.TABLE_NAME);
  }

  /**
   * 运行迁移
   */
  static async runMigrations(): Promise<void> {
    if (!this.testDb) {
      throw new Error('测试数据库未初始化');
    }

    console.log('🔄 运行数据库迁移...');
    
    try {
      // 检查是否有待运行的迁移
      const pending = await this.testDb.migrate.list();
      if (pending[1].length > 0) {
        console.log(`📋 发现 ${pending[1].length} 个待运行迁移`);
      }

      // 运行迁移
      const [batchNo, migrations] = await this.testDb.migrate.latest();
      
      if (migrations.length > 0) {
        console.log(`✅ 迁移完成 (批次 ${batchNo}):`);
        migrations.forEach((migration: string) => {
          console.log(`  - ${migration}`);
        });
      } else {
        console.log('✅ 所有迁移已是最新');
      }
    } catch (error) {
      console.error('❌ 运行迁移失败:', error);
      throw error;
    }
  }

  /**
   * 回滚迁移
   */
  static async rollbackMigrations(): Promise<void> {
    if (!this.testDb) {
      throw new Error('测试数据库未初始化');
    }

    const [batchNo, migrations] = await this.testDb.migrate.rollback();
    
    if (migrations.length > 0) {
      console.log(`🔄 回滚迁移 (批次 ${batchNo}):`);
      migrations.forEach((migration: string) => {
        console.log(`  - ${migration}`);
      });
    }
  }

  /**
   * 重置数据库（回滚所有迁移并重新运行）
   */
  static async resetDatabase(): Promise<void> {
    console.log('🔄 重置测试数据库...');
    
    // 回滚所有迁移
    await this.testDb?.migrate.rollback(undefined, true);
    
    // 重新运行迁移
    await this.runMigrations();
    
    console.log('✅ 数据库重置完成');
  }

  /**
   * 关闭连接
   */
  static async close(): Promise<void> {
    if (this.testDb) {
      await this.testDb.destroy();
      this.testDb = null;
    }
    
    await Database.close();
    this.isInitialized = false;
    
    console.log('📴 测试数据库连接已关闭');
  }

  /**
   * 获取数据库实例（用于直接查询）
   */
  static getDb(): Knex {
    if (!this.testDb) {
      throw new Error('测试数据库未初始化');
    }
    return this.testDb;
  }

  /**
   * 在事务中运行测试
   */
  static async runInTransaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    if (!this.testDb) {
      throw new Error('测试数据库未初始化');
    }

    return await this.testDb.transaction(callback);
  }
}