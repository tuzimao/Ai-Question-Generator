// src/migrations/003_create_document_sections_table.ts

import { Knex } from 'knex';

/**
 * 创建文档章节表迁移
 * 
 * 章节表设计说明:
 * - 存储文档的层级结构信息(标题、章节、子章节等)
 * - 支持多级嵌套的层级结构
 * - 保留文档的原始结构，便于后续智能分块
 * - 存储每个章节的位置信息，支持精确定位
 * - 适用于PDF目录结构和Markdown标题层级
 */

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('document_sections', (table) => {
    // 主键和关联字段
    table.string('section_id', 36).primary().comment('章节唯一标识符(UUID)');
    table.string('doc_id', 36).notNullable().comment('所属文档ID');
    table.string('parent_section_id', 36).nullable().comment('父章节ID，用于构建层级结构');
    
    // 章节层级和结构信息
    table.integer('level').unsigned().notNullable().comment('章节层级，1为顶级，2为二级，以此类推');
    table.string('title', 500).nullable().comment('章节标题，如果无法识别则为null');
    table.integer('section_order').unsigned().notNullable().comment('章节在同级中的排序序号');
    table.string('section_type', 50).defaultTo('section').comment('章节类型：section, toc, header, footer等');
    
    // 章节内容
    table.text('content', 'longtext').notNullable().comment('章节的原始文本内容');
    table.text('content_cleaned', 'longtext').nullable().comment('清洗后的文本内容');
    table.integer('token_count').unsigned().nullable().comment('章节Token数量估算');
    
    // 位置信息(适用于PDF)
    table.integer('start_page').unsigned().nullable().comment('起始页码(PDF特有)');
    table.integer('end_page').unsigned().nullable().comment('结束页码(PDF特有)');
    table.integer('start_char').unsigned().notNullable().comment('在文档中的起始字符位置');
    table.integer('end_char').unsigned().notNullable().comment('在文档中的结束字符位置');
    
    // Markdown特有字段
    table.string('markdown_heading', 10).nullable().comment('Markdown标题级别，如H1, H2, H3等');
    table.json('markdown_attributes').nullable().comment('Markdown扩展属性');
    
    // PDF特有字段
    table.json('pdf_coordinates').nullable().comment('PDF中的坐标信息 {x, y, width, height}');
    table.string('font_info', 200).nullable().comment('字体信息，用于标题识别');
    
    // 处理状态和质量评估
    table.enum('extraction_status', [
      'pending',    // 待提取
      'extracted',  // 已提取
      'cleaned',    // 已清洗
      'failed'      // 提取失败
    ]).defaultTo('pending').notNullable().comment('章节提取处理状态');
    
    table.decimal('confidence_score', 3, 2).nullable().comment('章节识别置信度(0.00-1.00)');
    table.json('quality_metrics').nullable().comment('内容质量指标');
    
    // 扩展元数据
    table.json('metadata').nullable().comment('章节扩展元数据');
    table.text('extraction_notes').nullable().comment('提取过程备注');
    
    // 时间戳字段
    table.timestamps(true, true); // created_at, updated_at
    
    // 外键约束
    table.foreign('doc_id').references('doc_id').inTable('documents').onDelete('CASCADE');
    table.foreign('parent_section_id').references('section_id').inTable('document_sections').onDelete('CASCADE');
    
    // 索引优化
    // 文档关联索引
    table.index(['doc_id'], 'idx_sections_doc_id');
    table.index(['doc_id', 'level'], 'idx_sections_doc_level');
    table.index(['doc_id', 'section_order'], 'idx_sections_doc_order');
    
    // 层级结构索引
    table.index(['parent_section_id'], 'idx_sections_parent_id');
    table.index(['level'], 'idx_sections_level');
    
    // 位置查询索引
    table.index(['doc_id', 'start_char'], 'idx_sections_doc_start');
    table.index(['doc_id', 'start_page'], 'idx_sections_doc_page');
    
    // 状态和类型索引
    table.index(['extraction_status'], 'idx_sections_status');
    table.index(['section_type'], 'idx_sections_type');
    
    // 复合索引：文档+层级+顺序，用于按结构顺序获取章节
    table.index(['doc_id', 'level', 'section_order'], 'idx_sections_hierarchy');
  });
}

/**
 * 回滚迁移：删除文档章节表
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('document_sections');
}