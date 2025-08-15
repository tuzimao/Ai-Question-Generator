// backend/scripts/setup-test-db.ts
import dotenv from 'dotenv';
import path from 'path';
import { TestDatabase } from '../test/utils/database';

// 加载测试环境变量
const envPath = path.join(__dirname, '../test/.env.test');
console.log('[setup-test-db] loading env from', envPath);
dotenv.config({ path: envPath });
console.log('[setup-test-db] DB_HOST after load =', process.env.DB_HOST);

async function setupTestDatabase() {
  try {
    console.log('🚀 设置测试数据库...');
    
    // 确保数据库存在
    await TestDatabase.ensureDatabaseExists();
    
    // 初始化连接
    await TestDatabase.initialize();
    
    // 运行迁移
    await TestDatabase.runMigrations();
    
    console.log('✅ 测试数据库设置完成！');
    
    // 显示数据库信息
    const tables = await TestDatabase.getAllTables();
    console.log(`📊 创建了 ${tables.length} 个表:`);
    tables.forEach(table => console.log(`  - ${table}`));
    
  } catch (error) {
    console.error('❌ 设置测试数据库失败:', error);
    process.exit(1);
  } finally {
    await TestDatabase.close();
  }
}

// 运行设置
setupTestDatabase();