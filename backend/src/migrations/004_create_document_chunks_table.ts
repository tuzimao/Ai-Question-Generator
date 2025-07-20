// src/migrations/004_create_document_chunks_table.ts

import { Knex } from 'knex';

/**
 * 创建文档块表迁移
 * 
 * 文档块表设计说明:
 * - 存储文档分块后的文本片段，是RAG检索的基本单位
 * - 每个chunk约400±100 tokens，适合向量化和检索
 * - 支持块间重叠，提高检索连续性
 * - 包含位置信息，支持精确溯源
 * - 为Milestone 2的向量化做准备
 */

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('document_chunks', (table) => {
    // 主键和关联字段
    table.string('chunk_id', 36).primary().comment('块唯一标识符(UUID)');
    table.string('doc_id', 36).notNullable().comment('所属文档ID');
    table.string('section_id', 36).nullable().comment('所属章节ID，可能跨章节为null');
    
    // 块序号和位置信息
    table.integer('chunk_index').unsigned().notNullable().comment('块在文档中的序号，从0开始');
    table.integer('start_char').unsigned().notNullable().comment('在文档中的起始字符位置');
    table.integer('end_char').unsigned().notNullable().comment('在文档中的结束字符位置');
    
    // 块内容和统计信息
    table.text('content').notNullable().comment('块的文本内容，最大约2000字符');
    table.text('content_cleaned').nullable().comment('清洗后的文本内容');
    table.integer('char_count').unsigned().notNullable().comment('字符数量');
    table.integer('token_count').unsigned().notNullable().comment('Token数量，目标400±100');
    table.integer('word_count').unsigned().nullable().comment('单词数量(英文)或字数(中文)');
    
    // 页面信息(PDF特有)
    table.json('page_span').nullable().comment('跨页信息 {"start": 1, "end": 2, "primary": 1}');
    table.integer('primary_page').unsigned().nullable().comment('主要页码(内容最多的页面)');
    
    // 重叠和关联信息
    table.json('overlap_with_prev').nullable().comment('与前一个块的重叠信息 {"chunk_id": "xxx", "overlap_chars": 60}');
    table.json('overlap_with_next').nullable().comment('与后一个块的重叠信息');
    table.json('related_chunks').nullable().comment('相关块ID列表，用于上下文扩展');
    
    // 分块策略和质量信息
    table.string('chunking_strategy', 50).defaultTo('fixed_size').comment('分块策略：fixed_size, semantic, hybrid等');
    table.enum('chunk_type', [
      'normal',      // 普通文本块
      'title',       // 标题块
      'list',        // 列表块
      'table',       // 表格块
      'code',        // 代码块
      'quote',       // 引用块
      'formula'      // 公式块
    ]).defaultTo('normal').notNullable().comment('块类型，影响处理策略');
    
    table.decimal('content_quality', 3, 2).nullable().comment('内容质量评分(0.00-1.00)');
    table.boolean('has_incomplete_sentence').defaultTo(false).comment('是否包含不完整句子');
    table.boolean('is_boundary_chunk').defaultTo(false).comment('是否为章节边界块');
    
    // 向量化状态(为Milestone 2准备)
    table.enum('embedding_status', [
      'pending',     // 待向量化
      'processing',  // 向量化中
      'completed',   // 已完成
      'failed'       // 向量化失败
    ]).defaultTo('pending').notNullable().comment('向量化处理状态');
    
    table.string('vector_id', 36).nullable().comment('Qdrant中的向量ID');
    table.timestamp('embedded_at').nullable().comment('向量化完成时间');
    table.string('embedding_model', 100).nullable().comment('使用的嵌入模型');
    
    // 检索优化字段
    table.json('keywords').nullable().comment('提取的关键词列表');
    table.json('entities').nullable().comment('识别的命名实体');
    table.text('summary').nullable().comment('块内容摘要(可选)');
    
    // 扩展元数据
    table.json('metadata').nullable().comment('块扩展元数据');
    table.json('chunking_config').nullable().comment('分块时使用的配置参数');
    table.text('processing_notes').nullable().comment('处理过程备注');
    
    // 时间戳字段
    table.timestamps(true, true); // created_at, updated_at
    
    // 外键约束
    table.foreign('doc_id').references('doc_id').inTable('documents').onDelete('CASCADE');
    table.foreign('section_id').references('section_id').inTable('document_sections').onDelete('SET NULL');
    
    // 索引优化
    // 文档关联索引
    table.index(['doc_id'], 'idx_chunks_doc_id');
    table.index(['doc_id', 'chunk_index'], 'idx_chunks_doc_index');
    table.index(['section_id'], 'idx_chunks_section_id');
    
    // 向量化状态索引
    table.index(['embedding_status'], 'idx_chunks_embedding_status');
    table.index(['vector_id'], 'idx_chunks_vector_id');
    table.index(['doc_id', 'embedding_status'], 'idx_chunks_doc_embedding');
    
    // 位置查询索引
    table.index(['doc_id', 'start_char'], 'idx_chunks_doc_start');
    table.index(['primary_page'], 'idx_chunks_primary_page');
    
    // 类型和质量索引
    table.index(['chunk_type'], 'idx_chunks_type');
    table.index(['content_quality'], 'idx_chunks_quality');
    
    // 复合索引：文档+索引，用于按顺序获取块
    table.index(['doc_id', 'chunk_index'], 'idx_chunks_sequence');
    
    // 唯一约束：确保同一文档内chunk_index不重复
    table.unique(['doc_id', 'chunk_index'], 'uk_chunks_doc_index');
  });
}

/**
 * 回滚迁移：删除文档块表
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('document_chunks');
}