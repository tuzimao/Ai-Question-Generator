// src/utils/database.ts - 数据库工具类（修正版本，使用现有的 DatabaseConfig）

import knex, { Knex } from 'knex';
import { DatabaseConfig } from '@/config/database';

/**
 * 数据库健康状态接口
 */
export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: Date;
  responseTime?: number;
  details?: any;
}

/**
 * 数据库管理类
 * 基于现有的 DatabaseConfig 类提供数据库连接管理和操作接口
 */
export class Database {
  private static instance: Knex | null = null;
  private static isConnected = false;

  /**
   * 初始化数据库连接
   */
  public static async initialize(): Promise<void> {
    try {
      console.log('📊 初始化数据库连接...');
      
      // 验证配置
      if (!DatabaseConfig.validateConfig()) {
        throw new Error('数据库配置验证失败');
      }
      
      // 创建数据库实例
      if (!this.instance) {
        const config = DatabaseConfig.getConfig();
        this.instance = knex(config);
        console.log(`📊 正在连接数据库: ${DatabaseConfig.getConnectionString()}`);
      }
      
      // 测试连接
      await this.testConnection();
      this.isConnected = true;
      
      console.log('✅ 数据库连接初始化成功');
      
      // 开发环境提示
      if (process.env.NODE_ENV === 'development') {
        console.log('💡 如需运行数据库迁移，请使用: npm run migrate:latest');
      }
      
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      this.isConnected = false;
      
      // 提供更详细的错误提示
      this.provideTroubleshootingTips(error);
      throw error;
    }
  }

  /**
   * 获取数据库实例
   */
  public static getInstance(): Knex {
    if (!this.instance) {
      // 验证配置
      if (!DatabaseConfig.validateConfig()) {
        throw new Error('数据库配置验证失败，请检查环境变量设置');
      }
      
      // 创建实例
      const config = DatabaseConfig.getConfig();
      this.instance = knex(config);
    }
    return this.instance;
  }

  /**
   * 测试数据库连接
   */
  private static async testConnection(): Promise<void> {
    if (!this.instance) {
      throw new Error('数据库实例未创建');
    }

    try {
      await this.instance.raw('SELECT 1 as test');
      console.log('✅ 数据库连接测试成功');
    } catch (error) {
      console.error('❌ 数据库连接测试失败:', error);
      this.provideTroubleshootingTips(error);
      throw error;
    }
  }

  /**
   * 提供故障排除提示
   */
  private static provideTroubleshootingTips(error: any): void {
    console.log('\n🔍 故障排除提示:');
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('econnrefused')) {
        console.log('💡 数据库服务器连接被拒绝，请检查:');
        console.log('   - 数据库服务是否运行：brew services start mysql');
        console.log('   - 主机地址和端口是否正确');
        console.log('   - 防火墙是否阻止连接');
      } else if (message.includes('access denied')) {
        console.log('💡 数据库访问被拒绝，请检查:');
        console.log('   - 用户名和密码是否正确');
        console.log('   - 用户是否有权限访问该数据库');
      } else if (message.includes('unknown database')) {
        console.log('💡 数据库不存在，请检查:');
        console.log('   - 数据库名称是否正确');
        console.log('   - 需要创建数据库：CREATE DATABASE ai_question_generator;');
      } else if (message.includes('配置验证失败')) {
        console.log('💡 配置验证失败，请确保 .env 文件包含:');
        console.log('   DB_HOST=localhost');
        console.log('   DB_USER=root');
        console.log('   DB_PASSWORD=your_password');
        console.log('   DB_NAME=ai_question_generator');
        console.log('   DB_PORT=3306');
      }
    }
    
    console.log('\n📋 当前环境变量状态:');
    console.log(`   DB_HOST: ${process.env.DB_HOST || '❌ 未设置'}`);
    console.log(`   DB_USER: ${process.env.DB_USER || '❌ 未设置'}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME || '❌ 未设置'}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT || '3306 (默认)'}`);
    console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '✅ 已设置' : '❌ 未设置'}`);
  }

  /**
   * 检查是否已连接
   */
  public static isConnectedToDatabase(): boolean {
    return this.isConnected && this.instance !== null;
  }

  /**
   * 健康检查
   */
  public static async healthCheck(): Promise<DatabaseHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.instance) {
        return {
          status: 'unhealthy',
          message: '数据库未初始化',
          timestamp: new Date()
        };
      }

      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          message: '数据库未连接',
          timestamp: new Date()
        };
      }

      // 执行简单查询测试连接
      await this.instance.raw('SELECT 1 as health_check');
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: '数据库连接正常',
        timestamp: new Date(),
        responseTime,
        details: {
          connectionString: DatabaseConfig.getConnectionString(),
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        message: `数据库连接失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        responseTime,
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * 执行事务
   */
  public static async withTransaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    if (!this.instance) {
      throw new Error('数据库未初始化');
    }

    return await this.instance.transaction(callback);
  }

  /**
   * 向后兼容：transaction 方法的别名
   */
  public static async transaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    return this.withTransaction(callback);
  }

  /**
   * 关闭数据库连接
   */
  public static async close(): Promise<void> {
    if (this.instance) {
      console.log('📊 关闭数据库连接...');
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
   * 获取表是否存在
   */
  public static async tableExists(tableName: string): Promise<boolean> {
    if (!this.instance) {
      throw new Error('数据库未初始化');
    }

    try {
      const result = await this.instance.schema.hasTable(tableName);
      return result;
    } catch (error) {
      console.error(`检查表 ${tableName} 是否存在失败:`, error);
      return false;
    }
  }

  /**
   * 获取数据库信息
   */
  public static async getInfo(): Promise<{
    version: string;
    connectionCount: number;
    uptime: number;
    charset: string;
    timezone: string;
  }> {
    if (!this.instance) {
      throw new Error('数据库未初始化');
    }

    try {
      // 获取数据库版本
      const [versionResult] = await this.instance.raw('SELECT VERSION() as version');
      
      // 获取状态信息
      const statusResults = await this.instance.raw('SHOW STATUS WHERE Variable_name IN ("Threads_connected", "Uptime")');
      
      const version = versionResult?.[0]?.version || 'unknown';
      
      // 解析状态信息
      let connectionCount = 0;
      let uptime = 0;
      
      if (Array.isArray(statusResults[0])) {
        statusResults[0].forEach((row: any) => {
          if (row.Variable_name === 'Threads_connected') {
            connectionCount = parseInt(row.Value, 10) || 0;
          } else if (row.Variable_name === 'Uptime') {
            uptime = parseInt(row.Value, 10) || 0;
          }
        });
      }

      return {
        version,
        connectionCount,
        uptime,
        charset: 'utf8mb4',
        timezone: '+08:00'
      };
      
    } catch (error) {
      console.error('获取数据库信息失败:', error);
      return {
        version: 'unknown',
        connectionCount: 0,
        uptime: 0,
        charset: 'utf8mb4',
        timezone: '+08:00'
      };
    }
  }

  /**
   * 获取所有表名
   */
  public static async getAllTables(): Promise<string[]> {
    if (!this.instance) {
      throw new Error('数据库未初始化');
    }

    try {
      const result = await this.instance.raw(`
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

  /**
   * 检查必要的表是否存在
   */
  public static async checkRequiredTables(): Promise<{
    allExist: boolean;
    missing: string[];
    existing: string[];
  }> {
    const requiredTables = [
      'processing_jobs',
      'users', 
      'documents'
      // 添加其他必要的表名
    ];

    const existing: string[] = [];
    const missing: string[] = [];

    for (const tableName of requiredTables) {
      try {
        const exists = await this.tableExists(tableName);
        if (exists) {
          existing.push(tableName);
        } else {
          missing.push(tableName);
        }
      } catch (error) {
        console.error(`检查表 ${tableName} 时出错:`, error);
        missing.push(tableName);
      }
    }

    return {
      allExist: missing.length === 0,
      missing,
      existing
    };
  }
}

// 延迟初始化数据库实例，避免在模块加载时立即执行
let dbInstance: Knex | null = null;

/**
 * 获取数据库实例的安全方法
 */
function getDatabase(): Knex {
  if (!dbInstance) {
    dbInstance = Database.getInstance();
  }
  return dbInstance;
}

/**
 * 数据库实例的 Proxy，支持函数调用和属性访问
 * 使用方法：
 * - 函数调用：db('table_name').select('*')
 * - 属性访问：db.raw('SELECT 1'), db.schema.hasTable('users')
 */
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

// 默认导出
export default Database;