// src/migrations/005_create_processing_jobs_table.ts

import { Knex } from 'knex';

/**
 * 创建处理作业表迁移
 * 
 * 处理作业表设计说明:
 * - 管理文档处理流水线中的异步作业
 * - 支持解析、分块、向量化等多种作业类型
 * - 包含重试机制和失败恢复
 * - 提供进度跟踪和性能监控
 * - 与BullMQ队列系统配合使用
 */

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('processing_jobs', (table) => {
    // 主键和关联字段
    table.string('job_id', 36).primary().comment('作业唯一标识符(UUID)');
    table.string('doc_id', 36).notNullable().comment('处理的文档ID');
    table.string('user_id', 36).notNullable().comment('作业发起用户ID');
    
    // 作业基本信息
    table.enum('job_type', [
      'parse_pdf',      // PDF解析作业
      'parse_markdown', // Markdown解析作业
      'parse_text',     // 纯文本解析作业
      'chunk_document', // 文档分块作业
      'embed_chunks',   // 块向量化作业(Milestone 2)
      'cleanup_temp'    // 临时文件清理作业
    ]).notNullable().comment('作业类型');
    
    table.enum('status', [
      'queued',       // 已入队，等待处理
      'processing',   // 处理中
      'completed',    // 已完成
      'failed',       // 失败
      'cancelled',    // 已取消
      'retry'         // 等待重试
    ]).defaultTo('queued').notNullable().comment('作业状态');
    
    // 优先级和队列管理
    table.integer('priority').defaultTo(5).comment('作业优先级，1-10，数字越小优先级越高');
    table.string('queue_name', 50).defaultTo('default').comment('队列名称');
    table.string('worker_id', 100).nullable().comment('处理该作业的工作器ID');
    
    // 重试机制
    table.integer('attempts').defaultTo(0).comment('已尝试次数');
    table.integer('max_attempts').defaultTo(3).comment('最大重试次数');
    table.timestamp('next_retry_at').nullable().comment('下次重试时间');
    table.integer('retry_delay_seconds').defaultTo(60).comment('重试延迟秒数');
    
    // 作业配置和输入参数
    table.json('job_config').nullable().comment('作业配置参数');
    table.json('input_params').nullable().comment('作业输入参数');
    table.text('file_path').nullable().comment('处理文件路径');
    
    // 进度跟踪
    table.integer('progress_current').defaultTo(0).comment('当前进度');
    table.integer('progress_total').defaultTo(100).comment('总进度');
    table.decimal('progress_percentage', 5, 2).defaultTo(0.00).comment('进度百分比');
    table.text('progress_message').nullable().comment('进度描述信息');
    table.json('progress_details').nullable().comment('详细进度信息');
    
    // 时间记录
    table.timestamp('queued_at').defaultTo(knex.fn.now()).comment('入队时间');
    table.timestamp('started_at').nullable().comment('开始处理时间');
    table.timestamp('completed_at').nullable().comment('完成时间');
    table.timestamp('failed_at').nullable().comment('失败时间');
    
    // 性能统计
    table.integer('processing_duration_ms').nullable().comment('处理耗时(毫秒)');
    table.integer('queue_wait_duration_ms').nullable().comment('队列等待时间(毫秒)');
    table.bigInteger('memory_usage_bytes').nullable().comment('内存使用量(字节)');
    table.bigInteger('disk_usage_bytes').nullable().comment('磁盘使用量(字节)');
    
    // 结果和错误信息
    table.json('result_data').nullable().comment('作业执行结果数据');
    table.text('error_message').nullable().comment('错误信息');
    table.text('error_stack').nullable().comment('错误堆栈信息');
    table.string('error_code', 50).nullable().comment('错误代码');
    
    // 日志和调试信息
    table.text('execution_log', 'longtext').nullable().comment('执行过程日志');
    table.json('debug_info').nullable().comment('调试信息');
    table.json('metrics').nullable().comment('性能指标和统计信息');
    
    // 依赖关系
    table.json('depends_on').nullable().comment('依赖的其他作业ID列表');
    table.json('triggers').nullable().comment('完成后触发的作业配置');
    
    // 通用时间戳字段
    table.timestamps(true, true); // created_at, updated_at
    
    // 外键约束
    table.foreign('doc_id').references('doc_id').inTable('documents').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // 索引优化
    // 队列处理核心索引
    table.index(['status', 'priority', 'queued_at'], 'idx_jobs_queue_priority');
    table.index(['queue_name', 'status'], 'idx_jobs_queue_status');
    table.index(['status'], 'idx_jobs_status');
    
    // 文档和用户关联索引
    table.index(['doc_id'], 'idx_jobs_doc_id');
    table.index(['user_id'], 'idx_jobs_user_id');
    table.index(['doc_id', 'job_type'], 'idx_jobs_doc_type');
    table.index(['user_id', 'status'], 'idx_jobs_user_status');
    
    // 时间查询索引
    table.index(['created_at'], 'idx_jobs_created_at');
    table.index(['started_at'], 'idx_jobs_started_at');
    table.index(['completed_at'], 'idx_jobs_completed_at');
    
    // 重试机制索引
    table.index(['status', 'next_retry_at'], 'idx_jobs_retry');
    table.index(['attempts', 'max_attempts'], 'idx_jobs_attempts');
    
    // 作业类型索引
    table.index(['job_type'], 'idx_jobs_type');
    table.index(['job_type', 'status'], 'idx_jobs_type_status');
    
    // 工作器相关索引
    table.index(['worker_id'], 'idx_jobs_worker_id');
    table.index(['worker_id', 'status'], 'idx_jobs_worker_status');
    
    // 复合查询索引
    table.index(['doc_id', 'job_type', 'status'], 'idx_jobs_doc_type_status');
  });
}

/**
 * 回滚迁移：删除处理作业表
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('processing_jobs');
}