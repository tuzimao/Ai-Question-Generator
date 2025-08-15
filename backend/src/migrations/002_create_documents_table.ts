// src/migrations/002_create_documents_table.ts

import { Knex } from 'knex';

/**
 * 创建文档表迁移
 * 
 * 文档表设计说明:
 * - 存储用户上传的文档基本信息和处理状态
 * - 支持PDF、Markdown等多种文档类型
 * - 包含完整的处理流水线状态跟踪
 * - 集成MinIO对象存储路径
 * - 支持文档去重(基于content_hash)
 */

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('documents', (table) => {
    // 主键和关联字段
    table.string('doc_id', 36).primary().comment('文档唯一标识符(UUID)');
    table.string('user_id', 36).notNullable().comment('文档所有者用户ID');
    
    // 文件基本信息
    table.string('filename', 255).notNullable().comment('原始文件名');
    table.string('content_hash', 64).notNullable().comment('文件内容SHA256哈希值，用于去重');
    table.string('mime_type', 100).notNullable().comment('文件MIME类型，如application/pdf');
    table.bigInteger('size_bytes').unsigned().notNullable().comment('文件大小(字节)');
    
    // 存储路径信息
    table.string('storage_path', 500).notNullable().comment('MinIO对象存储路径');
    table.string('storage_bucket', 100).notNullable().defaultTo('documents').comment('MinIO存储桶名称');
    
    // 文档解析结果字段
    table.integer('page_count').unsigned().nullable().comment('PDF页数，非PDF文档为null');
    table.string('language', 10).nullable().comment('文档语言检测结果，如zh-CN, en-US');
    table.integer('text_length').unsigned().nullable().comment('提取的纯文本长度');
    table.integer('token_estimate').unsigned().nullable().comment('估算的token数量');
    
    // 处理状态和流水线
    table.enum('ingest_status', [
      'uploading',   // 上传中
      'uploaded',    // 上传完成
      'parsing',     // 解析中
      'parsed',      // 解析完成
      'chunking',    // 分块处理中
      'chunked',     // 分块完成
      'embedding',   // 向量化中(Milestone 2)
      'ready',       // 完全就绪，可用于检索
      'failed'       // 处理失败
    ]).defaultTo('uploading').notNullable().comment('文档处理状态');
    
    // 错误和调试信息
    table.text('error_message').nullable().comment('处理失败时的错误信息');
    table.text('processing_log').nullable().comment('处理过程日志');
    
    // 扩展元数据(JSON格式)
    table.json('metadata').nullable().comment('文档元数据，如标题、作者、标签等');
    table.json('parse_config').nullable().comment('解析配置参数');
    table.json('chunk_config').nullable().comment('分块配置参数');
    
    // 时间戳字段
    table.timestamp('parsing_started_at').nullable().comment('开始解析时间');
    table.timestamp('parsing_completed_at').nullable().comment('解析完成时间');
    table.timestamp('chunking_started_at').nullable().comment('开始分块时间');
    table.timestamp('chunking_completed_at').nullable().comment('分块完成时间');
    
    // 通用时间戳字段
    table.timestamps(true, true); // created_at, updated_at
    table.timestamp('deleted_at').nullable().comment('软删除时间');
    
    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // 索引优化
    // 主要查询索引
    table.index(['user_id'], 'idx_documents_user_id');
    table.index(['content_hash'], 'idx_documents_content_hash');
    table.index(['ingest_status'], 'idx_documents_ingest_status');
    table.index(['created_at'], 'idx_documents_created_at');
    table.index(['mime_type'], 'idx_documents_mime_type');
    
    // 复合索引
    table.index(['user_id', 'ingest_status'], 'idx_documents_user_status');
    table.index(['user_id', 'created_at'], 'idx_documents_user_created');
    table.index(['ingest_status', 'created_at'], 'idx_documents_status_created');
    
    // 唯一索引：用户+内容哈希，防止同一用户重复上传相同文件
    table.unique(['user_id', 'content_hash'], 'uk_documents_user_hash');
  });
}

/**
 * 回滚迁移：删除文档表
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('documents');
}