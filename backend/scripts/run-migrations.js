// scripts/run-migrations.js
// 数据库迁移运行脚本

require('dotenv').config();

const knex = require('knex');
const { DatabaseConfig } = require('../dist/config/database');

async function runMigrations() {
  console.log('🔄 开始运行数据库迁移...');
  console.log('='.repeat(50));
  
  let db;
  
  try {
    // 验证数据库配置
    console.log('🔍 验证数据库配置...');
    const config = DatabaseConfig.getConfig();
    
    console.log(`📊 数据库信息:`);
    console.log(`   主机: ${config.connection.host}`);
    console.log(`   端口: ${config.connection.port}`);
    console.log(`   数据库: ${config.connection.database}`);
    console.log(`   用户: ${config.connection.user}`);
    
    // 创建数据库连接
    db = knex(config);
    
    // 测试连接
    console.log('🔗 测试数据库连接...');
    await db.raw('SELECT 1 as test');
    console.log('✅ 数据库连接成功');
    
    // 检查当前迁移状态
    console.log('\n📋 检查当前迁移状态...');
    try {
      const migrations = await db.migrate.currentVersion();
      console.log(`📍 当前迁移版本: ${migrations || 'none'}`);
    } catch (error) {
      console.log('📍 迁移表尚未创建，这是首次运行');
    }
    
    // 运行迁移
    console.log('\n🚀 运行迁移...');
    const [batchNo, log] = await db.migrate.latest();
    
    if (log.length === 0) {
      console.log('✅ 数据库已是最新版本，无需迁移');
    } else {
      console.log(`✅ 成功运行迁移批次 #${batchNo}`);
      console.log(`📝 执行的迁移文件:`);
      log.forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration}`);
      });
    }
    
    // 验证表创建
    console.log('\n🔍 验证表结构...');
    const tables = ['documents', 'document_sections', 'document_chunks', 'processing_jobs'];
    
    for (const tableName of tables) {
      const exists = await db.schema.hasTable(tableName);
      if (exists) {
        const columns = await db(tableName).columnInfo();
        const columnCount = Object.keys(columns).length;
        console.log(`✅ ${tableName}: ${columnCount} 列`);
      } else {
        console.log(`❌ ${tableName}: 表不存在`);
      }
    }
    
    // 显示数据库状态
    console.log('\n📊 数据库状态摘要:');
    const migrationTable = await db('knex_migrations').select('*').orderBy('id', 'desc').limit(5);
    console.log(`📈 迁移记录数: ${migrationTable.length}`);
    
    if (migrationTable.length > 0) {
      console.log('📋 最近的迁移:');
      migrationTable.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.name} (批次: ${record.batch})`);
      });
    }
    
    console.log('\n🎉 迁移完成！');
    
  } catch (error) {
    console.error('\n❌ 迁移过程中发生错误:');
    console.error(`错误信息: ${error.message}`);
    
    if (error.code) {
      console.error(`错误代码: ${error.code}`);
    }
    
    if (error.sqlMessage) {
      console.error(`SQL错误: ${error.sqlMessage}`);
    }
    
    console.error('\n💡 可能的解决方案:');
    console.error('1. 检查数据库连接配置');
    console.error('2. 确保数据库服务正在运行');
    console.error('3. 验证用户权限');
    console.error('4. 检查迁移文件语法');
    
    process.exit(1);
  } finally {
    if (db) {
      await db.destroy();
      console.log('📴 数据库连接已关闭');
    }
  }
}

// 检查迁移状态的函数
async function checkMigrationStatus() {
  console.log('🔍 检查迁移状态...');
  
  let db;
  try {
    const config = DatabaseConfig.getConfig();
    db = knex(config);
    
    // 获取迁移状态
    const completed = await db.migrate.list();
    const [pending] = await db.migrate.list();
    
    console.log('\n📊 迁移状态报告:');
    console.log(`✅ 已完成迁移: ${completed[0].length}`);
    console.log(`⏳ 待执行迁移: ${completed[1].length}`);
    
    if (completed[0].length > 0) {
      console.log('\n📋 已完成的迁移:');
      completed[0].forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration}`);
      });
    }
    
    if (completed[1].length > 0) {
      console.log('\n📋 待执行的迁移:');
      completed[1].forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 检查迁移状态失败:', error.message);
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

// 回滚迁移的函数
async function rollbackMigration() {
  console.log('🔄 回滚最后一批迁移...');
  
  let db;
  try {
    const config = DatabaseConfig.getConfig();
    db = knex(config);
    
    const [batchNo, log] = await db.migrate.rollback();
    
    if (log.length === 0) {
      console.log('✅ 没有可回滚的迁移');
    } else {
      console.log(`✅ 成功回滚批次 #${batchNo}`);
      console.log(`📝 回滚的迁移文件:`);
      log.forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 回滚迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

// 命令行参数处理
const command = process.argv[2];

switch (command) {
  case 'status':
    checkMigrationStatus();
    break;
  case 'rollback':
    rollbackMigration();
    break;
  case 'latest':
  default:
    runMigrations();
    break;
}