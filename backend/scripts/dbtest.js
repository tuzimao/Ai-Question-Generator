// test-db.js
require('dotenv').config();
const knex = require('knex');
const { DatabaseConfig } = require('../dist/config/database');

async function testDatabase() {
  try {
    const config = DatabaseConfig.getConfig();
    const db = knex(config);
    
    console.log('🔗 测试数据库连接...');
    await db.raw('SELECT 1 as test');
    console.log('✅ 数据库连接成功');
    
    console.log('📋 测试插入用户...');
    const testUserId = 'test-' + Date.now();
    await db('users').insert({
      id: testUserId,
      email: 'test@example.com',
      username: 'testuser',
      password_hash: 'fake-hash',
      display_name: 'Test User',
      role: 'teacher'
    });
    console.log('✅ 用户插入成功:', testUserId);
    
    console.log('📄 测试插入文档...');
    const docId = 'doc-' + Date.now();
    await db('documents').insert({
      doc_id: docId,
      user_id: testUserId,
      filename: 'test.txt',
      content_hash: 'fake-hash',
      mime_type: 'text/plain',
      size_bytes: 100,
      storage_path: 'test/path',
      ingest_status: 'uploaded'
    });
    console.log('✅ 文档插入成功:', docId);
    
    // 清理测试数据
    await db('documents').where('doc_id', docId).del();
    await db('users').where('id', testUserId).del();
    console.log('🧹 测试数据清理完成');
    
    await db.destroy();
    console.log('🎉 数据库测试完成');
    
  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
  }
}

testDatabase();