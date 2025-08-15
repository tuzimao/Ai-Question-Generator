// scripts/fix-migration-state.js
// 修复迁移状态脚本

require('dotenv').config();

const knex = require('knex');
const { DatabaseConfig } = require('../dist/config/database');

async function fixMigrationState() {
  console.log('🔧 修复迁移状态...');
  console.log('='.repeat(50));
  
  let db;
  
  try {
    // 连接数据库
    const config = DatabaseConfig.getConfig();
    db = knex(config);
    
    console.log('🔗 连接数据库成功');
    
    // 检查迁移表是否存在
    const migrationTableExists = await db.schema.hasTable('knex_migrations');
    
    if (!migrationTableExists) {
      console.log('📋 迁移表不存在，无需修复');
      return;
    }
    
    // 查看当前迁移记录
    console.log('\n📋 当前迁移记录:');
    const migrations = await db('knex_migrations').select('*').orderBy('id');
    
    migrations.forEach((migration, index) => {
      console.log(`   ${index + 1}. ${migration.name} (batch: ${migration.batch})`);
    });
    
    // 检查问题迁移
    const problematicMigrations = migrations.filter(m => m.name.endsWith('.ts'));
    
    if (problematicMigrations.length === 0) {
      console.log('\n✅ 没有发现问题迁移，迁移状态正常');
      return;
    }
    
    console.log(`\n⚠️ 发现 ${problematicMigrations.length} 个问题迁移:`);
    problematicMigrations.forEach(m => {
      console.log(`   - ${m.name} (应该是 ${m.name.replace('.ts', '.js')})`);
    });
    
    // 询问是否修复
    console.log('\n🤔 修复方案选择:');
    console.log('1. 更新迁移记录的文件扩展名 (.ts -> .js)');
    console.log('2. 完全重置迁移状态 (清空迁移表)');
    console.log('3. 手动指定处理方式');
    
    // 自动选择方案1 (更安全)
    console.log('\n🔄 执行方案1: 更新文件扩展名...');
    
    // 开始事务
    await db.transaction(async (trx) => {
      for (const migration of problematicMigrations) {
        const newName = migration.name.replace('.ts', '.js');
        
        await trx('knex_migrations')
          .where('id', migration.id)
          .update({ name: newName });
          
        console.log(`✅ 更新: ${migration.name} -> ${newName}`);
      }
    });
    
    console.log('\n📋 修复后的迁移记录:');
    const updatedMigrations = await db('knex_migrations').select('*').orderBy('id');
    
    updatedMigrations.forEach((migration, index) => {
      console.log(`   ${index + 1}. ${migration.name} (batch: ${migration.batch})`);
    });
    
    console.log('\n🎉 迁移状态修复完成！');
    console.log('💡 现在可以运行: npm run migrate:run');
    
  } catch (error) {
    console.error('\n❌ 修复过程中发生错误:', error.message);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('💡 可能是首次设置，请直接运行迁移');
    }
    
    process.exit(1);
  } finally {
    if (db) {
      await db.destroy();
      console.log('📴 数据库连接已关闭');
    }
  }
}

// 重置迁移状态函数
async function resetMigrationState() {
  console.log('🔄 重置迁移状态...');
  console.log('⚠️ 警告：这将删除所有迁移记录！');
  
  let db;
  
  try {
    const config = DatabaseConfig.getConfig();
    db = knex(config);
    
    // 检查迁移表
    const migrationTableExists = await db.schema.hasTable('knex_migrations');
    
    if (migrationTableExists) {
      // 清空迁移记录
      await db('knex_migrations').del();
      console.log('✅ 迁移记录已清空');
      
      // 可选：删除迁移表
      // await db.schema.dropTable('knex_migrations');
      // console.log('✅ 迁移表已删除');
    }
    
    const lockTableExists = await db.schema.hasTable('knex_migrations_lock');
    if (lockTableExists) {
      await db('knex_migrations_lock').del();
      console.log('✅ 迁移锁记录已清空');
    }
    
    console.log('\n🎉 迁移状态重置完成！');
    console.log('💡 现在可以重新运行: npm run migrate:run');
    
  } catch (error) {
    console.error('\n❌ 重置过程中发生错误:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

// 检查当前状态函数
async function checkCurrentState() {
  console.log('🔍 检查当前迁移状态...');
  
  let db;
  
  try {
    const config = DatabaseConfig.getConfig();
    db = knex(config);
    
    // 检查表是否存在
    const tables = ['knex_migrations', 'knex_migrations_lock', 'users', 'documents'];
    
    console.log('\n📊 表存在性检查:');
    for (const table of tables) {
      const exists = await db.schema.hasTable(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }
    
    // 检查迁移记录
    const migrationTableExists = await db.schema.hasTable('knex_migrations');
    
    if (migrationTableExists) {
      const migrations = await db('knex_migrations').select('*').orderBy('id');
      
      console.log('\n📋 迁移记录:');
      if (migrations.length === 0) {
        console.log('   (无记录)');
      } else {
        migrations.forEach((migration, index) => {
          const status = migration.name.endsWith('.ts') ? '⚠️' : '✅';
          console.log(`   ${status} ${migration.name} (batch: ${migration.batch})`);
        });
      }
    }
    
  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

// 命令行参数处理
const command = process.argv[2];

switch (command) {
  case 'reset':
    resetMigrationState();
    break;
  case 'check':
    checkCurrentState();
    break;
  case 'fix':
  default:
    fixMigrationState();
    break;
}