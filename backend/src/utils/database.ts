// src/utils/database.ts (修复版本) - 方案1：修复Proxy实现

import knex, { Knex } from 'knex';
import { DatabaseConfig } from '@/config/database';

/**
 * 数据库工具类
 * 提供数据库连接管理和通用操作方法
 * 
 * 注意：migrations/seeds 配置由 knexfile.ts 管理，这里只处理运行时的数据库连接
 */
export class Database {
  private static instance: Knex | null = null;
  private static isConnected: boolean = false;

  /**
   * 获取数据库连接实例
   * @returns Knex实例
   */
  public static getInstance(): Knex {
    if (!this.instance) {
      this.instance = this.createConnection();
    }
    return this.instance;
  }

  /**
   * 创建数据库连接
   * @returns Knex实例
   */
  private static createConnection(): Knex {
    try {
      // 验证配置
      if (!DatabaseConfig.validateConfig()) {
        throw new Error('数据库配置验证失败');
      }

      // 获取纯连接配置（不包含 migrations/seeds）
      const config = DatabaseConfig.getConfig();
      const connection = knex(config);

      console.log(`📊 正在连接数据库: ${DatabaseConfig.getConnectionString()}`);
      
      return connection;
    } catch (error) {
      console.error('❌ 数据库连接创建失败:', error);
      throw error;
    }
  }

  /**
   * 初始化数据库连接
   * 测试连接，但不运行迁移（迁移由 knex CLI 工具处理）
   */
  public static async initialize(): Promise<void> {
    try {
      const db = this.getInstance();

      // 测试数据库连接
      await this.testConnection(db);

      this.isConnected = true;
      console.log('✅ 数据库连接初始化完成');
      
      // 提示：迁移需要单独运行
      if (process.env.NODE_ENV === 'development') {
        console.log('💡 如需运行数据库迁移，请使用: npm run migrate:latest');
      }
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 测试数据库连接
   * @param db Knex实例
   */
  private static async testConnection(db: Knex): Promise<void> {
    try {
      await db.raw('SELECT 1 as test');
      console.log('✅ 数据库连接测试成功');
    } catch (error) {
      console.error('❌ 数据库连接测试失败:', error);
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: string }).message
        : String(error);
      throw new Error(`数据库连接失败: ${errorMessage}`);
    }
  }

  /**
   * 检查数据库连接状态
   * @returns 是否已连接
   */
  public static isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  /**
   * 关闭数据库连接
   */
  public static async close(): Promise<void> {
    if (this.instance) {
      try {
        await this.instance.destroy();
        this.instance = null;
        this.isConnected = false;
        console.log('✅ 数据库连接已关闭');
      } catch (error) {
        console.error('❌ 关闭数据库连接失败:', error);
      }
    }
  }

  /**
   * 开始事务
   * @returns 事务对象
   */
  public static async beginTransaction(): Promise<Knex.Transaction> {
    const db = this.getInstance();
    return await db.transaction();
  }

  /**
   * 安全执行数据库操作（自动处理事务）
   * @param operation 数据库操作函数
   * @returns 操作结果
   */
  public static async withTransaction<T>(
    operation: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    const db = this.getInstance();
    
    return await db.transaction(async (trx) => {
      try {
        const result = await operation(trx);
        return result; // Knex会自动commit
      } catch (error) {
        throw error; // Knex会自动rollback
      }
    });
  }

  /**
   * 🔧 向后兼容：transaction 方法的别名
   * @param operation 数据库操作函数
   * @returns 操作结果
   */
  public static async transaction<T>(
    operation: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    return this.withTransaction(operation);
  }

  /**
   * 健康检查
   * @returns 健康状态信息
   */
  public static async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    details?: any;
  }> {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          message: '数据库未连接'
        };
      }

      const db = this.getInstance();
      const startTime = Date.now();
      
      // 执行简单查询测试
      await db.raw('SELECT 1 as health_check');
      
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        message: '数据库连接正常',
        details: {
          responseTime: `${responseTime}ms`,
          connectionString: DatabaseConfig.getConnectionString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: '数据库健康检查失败',
        details: {
          error: typeof error === 'object' && error !== null && 'message' in error
            ? (error as { message: string }).message
            : String(error)
        }
      };
    }
  }

  /**
   * 获取数据库信息
   * @returns 数据库信息
   */
  public static async getInfo(): Promise<any> {
    try {
      const db = this.getInstance();
      
      // 获取数据库版本
      const [versionResult] = await db.raw('SELECT VERSION() as version');
      
      // 获取数据库大小（MySQL）
      const [sizeResult] = await db.raw(`
        SELECT 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
      `);

      return {
        version: versionResult.version,
        size: `${sizeResult.size_mb || 0} MB`,
        charset: 'utf8mb4',
        timezone: '+08:00'
      };
    } catch (error) {
      console.error('获取数据库信息失败:', error);
      return null;
    }
  }

  /**
   * 检查表是否存在
   * @param tableName 表名
   * @returns 是否存在
   */
  public static async hasTable(tableName: string): Promise<boolean> {
    try {
      const db = this.getInstance();
      return await db.schema.hasTable(tableName);
    } catch (error) {
      console.error(`检查表 ${tableName} 是否存在失败:`, error);
      return false;
    }
  }

  /**
   * 获取所有表名
   * @returns 表名列表
   */
  public static async getAllTables(): Promise<string[]> {
    try {
      const db = this.getInstance();
      const result = await db.raw(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
      `);
      
      return result[0].map((row: any) => row.table_name || row.TABLE_NAME);
    } catch (error) {
      console.error('获取表列表失败:', error);
      return [];
    }
  }
}

// 🔧 修复：延迟初始化数据库实例，避免在模块加载时立即执行
let dbInstance: Knex | null = null;

/**
 * 获取数据库实例的安全方法
 * @returns Knex实例
 */
export function getDatabase(): Knex {
  if (!dbInstance) {
    dbInstance = Database.getInstance();
  }
  return dbInstance;
}

// 🔧 修复：完全重新实现 db 导出，支持函数调用
export const db = new Proxy((() => {}) as any, {
  // 拦截函数调用：db('table_name')
  apply(_target, _thisArg, argArray) {
    const instance = getDatabase();
    return instance(...argArray);
  },
  
  // 拦截属性访问：db.raw, db.schema 等
  get(_target, prop) {
    const instance = getDatabase();
    const value = instance[prop as keyof Knex];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
}) as Knex;

// 默认导出Database类
export default Database;