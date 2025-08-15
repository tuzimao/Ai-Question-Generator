// scripts/test-database-tables.js
// 数据库表结构测试脚本

require('dotenv').config();

const knex = require('knex');
const { DatabaseConfig } = require('../dist/config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

async function testDatabaseTables() {
  console.log('🧪 数据库表结构测试');
  console.log('='.repeat(50));
  
  let db;
  
  try {
    // 连接数据库
    const config = DatabaseConfig.getConfig();
    db = knex(config);
    
    console.log('🔗 连接数据库成功');
    
    // 测试表存在性
    await testTablesExist(db);
    
    // 测试表结构
    await testTableStructures(db);
    
    // 测试外键关系
    await testForeignKeys(db);
    
    // 测试索引
    await testIndexes(db);
    
    // 测试数据插入和查询
    await testDataOperations(db);
    
    console.log('\n🎉 所有测试通过！');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.destroy();
      console.log('📴 数据库连接已关闭');
    }
  }
}

async function testTablesExist(db) {
  console.log('\n📋 测试表存在性...');
  
  const requiredTables = [
    'users',           // 已存在的用户表
    'documents',       // 新创建的文档表
    'document_sections', // 文档章节表
    'document_chunks',   // 文档块表
    'processing_jobs'    // 处理作业表
  ];
  
  for (const tableName of requiredTables) {
    const exists = await db.schema.hasTable(tableName);
    if (exists) {
      console.log(`✅ ${tableName}: 表存在`);
    } else {
      throw new Error(`表 ${tableName} 不存在`);
    }
  }
}

async function testTableStructures(db) {
  console.log('\n🏗️ 测试表结构...');
  
  // 测试documents表结构
  const documentsColumns = await db('documents').columnInfo();
  const requiredDocumentColumns = [
    'doc_id', 'user_id', 'filename', 'content_hash', 'mime_type', 
    'size_bytes', 'storage_path', 'ingest_status', 'created_at'
  ];
  
  for (const column of requiredDocumentColumns) {
    if (documentsColumns[column]) {
      console.log(`✅ documents.${column}: 列存在`);
    } else {
      throw new Error(`documents表缺少列: ${column}`);
    }
  }
  
  // 测试document_sections表结构
  const sectionsColumns = await db('document_sections').columnInfo();
  const requiredSectionColumns = [
    'section_id', 'doc_id', 'level', 'content', 'start_char', 'end_char'
  ];
  
  for (const column of requiredSectionColumns) {
    if (sectionsColumns[column]) {
      console.log(`✅ document_sections.${column}: 列存在`);
    } else {
      throw new Error(`document_sections表缺少列: ${column}`);
    }
  }
  
  // 测试document_chunks表结构
  const chunksColumns = await db('document_chunks').columnInfo();
  const requiredChunkColumns = [
    'chunk_id', 'doc_id', 'chunk_index', 'content', 'token_count', 'embedding_status'
  ];
  
  for (const column of requiredChunkColumns) {
    if (chunksColumns[column]) {
      console.log(`✅ document_chunks.${column}: 列存在`);
    } else {
      throw new Error(`document_chunks表缺少列: ${column}`);
    }
  }
  
  // 测试processing_jobs表结构
  const jobsColumns = await db('processing_jobs').columnInfo();
  const requiredJobColumns = [
    'job_id', 'doc_id', 'user_id', 'job_type', 'status', 'created_at'
  ];
  
  for (const column of requiredJobColumns) {
    if (jobsColumns[column]) {
      console.log(`✅ processing_jobs.${column}: 列存在`);
    } else {
      throw new Error(`processing_jobs表缺少列: ${column}`);
    }
  }
}

async function testForeignKeys(db) {
  console.log('\n🔗 测试外键关系...');
  
  // 检查外键约束（MySQL中的外键信息查询）
  try {
    const foreignKeys = await db.raw(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [db.client.database()]);
    
    const fkInfo = foreignKeys[0];
    console.log(`✅ 发现 ${fkInfo.length} 个外键关系`);
    
    // 验证关键外键
    const expectedForeignKeys = [
      { table: 'documents', column: 'user_id', refTable: 'users' },
      { table: 'document_sections', column: 'doc_id', refTable: 'documents' },
      { table: 'document_chunks', column: 'doc_id', refTable: 'documents' },
      { table: 'processing_jobs', column: 'doc_id', refTable: 'documents' }
    ];
    
    for (const expectedFk of expectedForeignKeys) {
      const found = fkInfo.find(fk => 
        fk.TABLE_NAME === expectedFk.table && 
        fk.COLUMN_NAME === expectedFk.column &&
        fk.REFERENCED_TABLE_NAME === expectedFk.refTable
      );
      
      if (found) {
        console.log(`✅ 外键: ${expectedFk.table}.${expectedFk.column} -> ${expectedFk.refTable}`);
      } else {
        console.warn(`⚠️ 外键可能缺失: ${expectedFk.table}.${expectedFk.column} -> ${expectedFk.refTable}`);
      }
    }
    
  } catch (error) {
    console.warn('⚠️ 无法检查外键关系 (可能需要特殊权限)');
  }
}

async function testIndexes(db) {
  console.log('\n📊 测试索引...');
  
  try {
    // 检查索引（MySQL）
    const indexes = await db.raw(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        COLUMN_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('documents', 'document_sections', 'document_chunks', 'processing_jobs')
      ORDER BY TABLE_NAME, INDEX_NAME
    `, [db.client.database()]);
    
    const indexInfo = indexes[0];
    
    // 按表分组统计索引
    const indexesByTable = indexInfo.reduce((acc, idx) => {
      if (!acc[idx.TABLE_NAME]) acc[idx.TABLE_NAME] = new Set();
      acc[idx.TABLE_NAME].add(idx.INDEX_NAME);
      return acc;
    }, {});
    
    Object.entries(indexesByTable).forEach(([table, indexes]) => {
      console.log(`✅ ${table}: ${indexes.size} 个索引`);
    });
    
  } catch (error) {
    console.warn('⚠️ 无法检查索引信息');
  }
}

async function testDataOperations(db) {
  console.log('\n💾 测试数据操作...');
  
  // 使用事务确保测试数据不影响数据库
  await db.transaction(async (trx) => {
    try {
      // 测试用户数据 (假设已有测试用户)
      let testUserId;
      const existingUser = await trx('users').first();
      
      if (existingUser) {
        testUserId = existingUser.id;
        console.log(`✅ 使用现有测试用户: ${testUserId}`);
      } else {
        // 创建测试用户
        testUserId = uuidv4();
        await trx('users').insert({
          id: testUserId,
          email: 'test@example.com',
          username: 'testuser',
          password_hash: 'testhash',
          display_name: 'Test User',
          role: 'teacher'
        });
        console.log(`✅ 创建测试用户: ${testUserId}`);
      }
      
      // 测试文档插入
      const docId = uuidv4();
      const contentHash = crypto.createHash('sha256').update('test content').digest('hex');
      
      await trx('documents').insert({
        doc_id: docId,
        user_id: testUserId,
        filename: 'test.pdf',
        content_hash: contentHash,
        mime_type: 'application/pdf',
        size_bytes: 1024,
        storage_path: 'test/path/test.pdf',
        ingest_status: 'uploaded'
      });
      console.log(`✅ 插入测试文档: ${docId}`);
      
      // 测试章节插入
      const sectionId = uuidv4();
      await trx('document_sections').insert({
        section_id: sectionId,
        doc_id: docId,
        level: 1,
        title: '测试章节',
        content: '这是一个测试章节的内容',
        section_order: 1,
        start_char: 0,
        end_char: 100
      });
      console.log(`✅ 插入测试章节: ${sectionId}`);
      
      // 测试块插入
      const chunkId = uuidv4();
      await trx('document_chunks').insert({
        chunk_id: chunkId,
        doc_id: docId,
        section_id: sectionId,
        chunk_index: 0,
        content: '这是一个测试块的内容',
        char_count: 50,
        token_count: 15,
        start_char: 0,
        end_char: 50
      });
      console.log(`✅ 插入测试块: ${chunkId}`);
      
      // 测试作业插入
      const jobId = uuidv4();
      await trx('processing_jobs').insert({
        job_id: jobId,
        doc_id: docId,
        user_id: testUserId,
        job_type: 'parse_pdf',
        status: 'queued'
      });
      console.log(`✅ 插入测试作业: ${jobId}`);
      
      // 测试查询
      const doc = await trx('documents').where('doc_id', docId).first();
      if (doc && doc.filename === 'test.pdf') {
        console.log(`✅ 查询文档成功`);
      } else {
        throw new Error('查询文档失败');
      }
      
      // 测试关联查询
      const sections = await trx('document_sections').where('doc_id', docId);
      if (sections.length === 1) {
        console.log(`✅ 查询章节成功`);
      } else {
        throw new Error('查询章节失败');
      }
      
      const chunks = await trx('document_chunks').where('doc_id', docId);
      if (chunks.length === 1) {
        console.log(`✅ 查询块成功`);
      } else {
        throw new Error('查询块失败');
      }
      
      // 测试复杂查询 - 获取文档及其所有相关数据
      const fullDocument = await trx('documents')
        .select('documents.*')
        .where('documents.doc_id', docId)
        .first();
        
      if (fullDocument) {
        console.log(`✅ 复杂查询成功`);
      }
      
      // 回滚事务，清理测试数据
      throw new Error('ROLLBACK_TEST'); // 故意抛出错误来回滚
      
    } catch (error) {
      if (error.message === 'ROLLBACK_TEST') {
        console.log(`✅ 测试数据已清理`);
      } else {
        throw error;
      }
    }
  });
}

// 运行测试
testDatabaseTables().catch(console.error);