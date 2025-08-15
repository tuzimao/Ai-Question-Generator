// src/migrations/001_create_users_table.ts

import { Knex } from 'knex';

/**
 * 创建用户表迁移
 * 
 * 用户表设计说明:
 * - 使用UUID作为主键，提高安全性
 * - 支持多种用户角色（学生、教师、管理员）
 * - 包含完整的用户信息字段
 * - 支持软删除功能
 * - 添加必要的索引提高查询性能
 */

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    // 主键和基础字段
    table.string('id', 36).primary().comment('用户唯一标识符(UUID)');
    
    // 认证相关字段
    table.string('email', 255).unique().notNullable().comment('用户邮箱，用于登录');
    table.string('username', 100).unique().notNullable().comment('用户名，用于显示');
    table.string('password_hash', 255).notNullable().comment('密码哈希值');
    
    // 用户信息字段
    table.string('display_name', 100).notNullable().comment('显示名称');
    table.enum('role', ['student', 'teacher', 'admin'])
         .defaultTo('teacher')
         .notNullable()
         .comment('用户角色: student-学生, teacher-教师, admin-管理员');
    
    // 可选信息字段
    table.string('avatar', 500).nullable().comment('头像URL');
    table.text('bio').nullable().comment('个人简介');
    table.string('phone', 20).nullable().comment('手机号码');
    
    // 状态字段
    table.boolean('is_active').defaultTo(true).notNullable().comment('账户是否激活');
    table.boolean('email_verified').defaultTo(false).notNullable().comment('邮箱是否已验证');
    
    // 时间戳字段
    table.timestamp('last_login_at').nullable().comment('最后登录时间');
    table.timestamp('email_verified_at').nullable().comment('邮箱验证时间');
    table.timestamp('password_changed_at').defaultTo(knex.fn.now()).comment('密码最后修改时间');
    
    // 通用时间戳字段
    table.timestamps(true, true); // created_at, updated_at
    table.timestamp('deleted_at').nullable().comment('软删除时间');
    
    // 元数据字段
    table.json('preferences').nullable().comment('用户偏好设置(JSON)');
    table.json('metadata').nullable().comment('扩展元数据(JSON)');
    
    // 添加索引
    table.index(['email'], 'idx_users_email');
    table.index(['username'], 'idx_users_username');
    table.index(['role'], 'idx_users_role');
    table.index(['is_active'], 'idx_users_is_active');
    table.index(['created_at'], 'idx_users_created_at');
    table.index(['deleted_at'], 'idx_users_deleted_at');
    
    // 复合索引
    table.index(['role', 'is_active'], 'idx_users_role_active');
    table.index(['email', 'is_active'], 'idx_users_email_active');
  });
}

/**
 * 回滚迁移：删除用户表
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('users');
}