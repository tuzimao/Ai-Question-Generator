// src/models/User.ts

import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { db } from '@/utils/database';
import { User, UserRole } from '@/types/base';

/**
 * 创建用户请求接口
 */
export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  display_name: string;
  role?: UserRole;
  bio?: string;
  phone?: string;
}

/**
 * 更新用户请求接口
 */
export interface UpdateUserRequest {
  username?: string;
  display_name?: string;
  bio?: string;
  phone?: string;
  avatar?: string;
  preferences?: Record<string, any>;
}

/**
 * 用户查询选项接口
 */
export interface UserQueryOptions {
  includeDeleted?: boolean;
  role?: UserRole;
  isActive?: boolean;
  emailVerified?: boolean;
}

/**
 * 用户模型类
 * 提供用户相关的数据库操作方法
 */
export class UserModel {
  private static readonly TABLE_NAME = 'users';
  private static readonly BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

  /**
   * 创建新用户
   * @param userData 用户数据
   * @param trx 可选的数据库事务
   * @returns 创建的用户信息（不包含密码）
   */
  public static async create(
    userData: CreateUserRequest,
    trx?: Knex.Transaction
  ): Promise<Omit<User, 'password_hash'>> {
    const dbInstance = trx || db;

    try {
      // 检查邮箱是否已存在
      const existingUser = await this.findByEmail(userData.email, { includeDeleted: true });
      if (existingUser) {
        throw new Error('邮箱已被注册');
      }

      // 检查用户名是否已存在
      const existingUsername = await this.findByUsername(userData.username, { includeDeleted: true });
      if (existingUsername) {
        throw new Error('用户名已被占用');
      }

      // 生成密码哈希
      const passwordHash = await bcrypt.hash(userData.password, this.BCRYPT_ROUNDS);

      // 准备用户数据
      const userId = uuidv4();
      const userRecord = {
        id: userId,
        email: userData.email.toLowerCase().trim(),
        username: userData.username.trim(),
        password_hash: passwordHash,
        display_name: userData.display_name.trim(),
        role: userData.role || UserRole.TEACHER,
        bio: userData.bio?.trim() || null,
        phone: userData.phone?.trim() || null,
        is_active: true,
        email_verified: false,
        password_changed_at: new Date()
      };

      // 插入用户记录
      await dbInstance(this.TABLE_NAME).insert(userRecord);

      // 返回用户信息（不包含密码）
      const createdUser = await this.findById(userId);
      if (!createdUser) {
        throw new Error('用户创建失败');
      }

      return createdUser;
    } catch (error) {
      console.error('用户创建失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找用户
   * @param id 用户ID
   * @param options 查询选项
   * @returns 用户信息（不包含密码）
   */
  public static async findById(
    id: string,
    options: UserQueryOptions = {}
  ): Promise<Omit<User, 'password_hash'> | null> {
    try {
      let query = db(this.TABLE_NAME)
        .select(this.getSelectFields())
        .where('id', id);

      // 应用查询选项
      query = this.applyQueryOptions(query, options);

      const user = await query.first();
      return user || null;
    } catch (error) {
      console.error('查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 根据邮箱查找用户（包含密码，用于认证）
   * @param email 邮箱
   * @param options 查询选项
   * @returns 用户信息（包含密码）
   */
  public static async findByEmailWithPassword(
    email: string,
    options: UserQueryOptions = {}
  ): Promise<User | null> {
    try {
      let query = db(this.TABLE_NAME)
        .select('*')
        .where('email', email.toLowerCase().trim());

      query = this.applyQueryOptions(query, options);

      const user = await query.first();
      return user || null;
    } catch (error) {
      console.error('查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 根据邮箱查找用户（不包含密码）
   * @param email 邮箱
   * @param options 查询选项
   * @returns 用户信息（不包含密码）
   */
  public static async findByEmail(
    email: string,
    options: UserQueryOptions = {}
  ): Promise<Omit<User, 'password_hash'> | null> {
    try {
      let query = db(this.TABLE_NAME)
        .select(this.getSelectFields())
        .where('email', email.toLowerCase().trim());

      query = this.applyQueryOptions(query, options);

      const user = await query.first();
      return user || null;
    } catch (error) {
      console.error('查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 根据用户名查找用户
   * @param username 用户名
   * @param options 查询选项
   * @returns 用户信息（不包含密码）
   */
  public static async findByUsername(
    username: string,
    options: UserQueryOptions = {}
  ): Promise<Omit<User, 'password_hash'> | null> {
    try {
      let query = db(this.TABLE_NAME)
        .select(this.getSelectFields())
        .where('username', username.trim());

      query = this.applyQueryOptions(query, options);

      const user = await query.first();
      return user || null;
    } catch (error) {
      console.error('查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param id 用户ID
   * @param updates 更新数据
   * @param trx 可选的数据库事务
   * @returns 更新后的用户信息
   */
  public static async update(
    id: string,
    updates: UpdateUserRequest,
    trx?: Knex.Transaction
  ): Promise<Omit<User, 'password_hash'> | null> {
    const dbInstance = trx || db;

    try {
      // 检查用户是否存在
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new Error('用户不存在');
      }

      // 如果更新用户名，检查是否重复
      if (updates.username && updates.username !== existingUser.username) {
        const usernameExists = await this.findByUsername(updates.username, { includeDeleted: true });
        if (usernameExists) {
          throw new Error('用户名已被占用');
        }
      }

      // 准备更新数据
      const updateData: any = {
        ...updates,
        updated_at: new Date()
      };

      // 清理空值
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // 执行更新
      await dbInstance(this.TABLE_NAME)
        .where('id', id)
        .update(updateData);

      // 返回更新后的用户信息
      return await this.findById(id);
    } catch (error) {
      console.error('更新用户失败:', error);
      throw error;
    }
  }

  /**
   * 软删除用户
   * @param id 用户ID
   * @param trx 可选的数据库事务
   * @returns 是否删除成功
   */
  public static async softDelete(id: string, trx?: Knex.Transaction): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const result = await dbInstance(this.TABLE_NAME)
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          deleted_at: new Date(),
          is_active: false,
          updated_at: new Date()
        });

      return result > 0;
    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  }

  /**
   * 验证用户密码
   * @param password 明文密码
   * @param passwordHash 密码哈希
   * @returns 是否匹配
   */
  public static async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, passwordHash);
    } catch (error) {
      console.error('密码验证失败:', error);
      return false;
    }
  }

  /**
   * 更新用户密码
   * @param id 用户ID
   * @param newPassword 新密码
   * @param trx 可选的数据库事务
   * @returns 是否更新成功
   */
  public static async updatePassword(
    id: string,
    newPassword: string,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
      
      const result = await dbInstance(this.TABLE_NAME)
        .where('id', id)
        .update({
          password_hash: passwordHash,
          password_changed_at: new Date(),
          updated_at: new Date()
        });

      return result > 0;
    } catch (error) {
      console.error('更新密码失败:', error);
      throw error;
    }
  }

  /**
   * 更新最后登录时间
   * @param id 用户ID
   * @param trx 可选的数据库事务
   */
  public static async updateLastLogin(id: string, trx?: Knex.Transaction): Promise<void> {
    const dbInstance = trx || db;

    try {
      await dbInstance(this.TABLE_NAME)
        .where('id', id)
        .update({
          last_login_at: new Date(),
          updated_at: new Date()
        });
    } catch (error) {
      console.error('更新最后登录时间失败:', error);
      throw error;
    }
  }

  /**
   * 获取选择字段（排除密码）
   * @returns 字段数组
   */
  private static getSelectFields(): string[] {
    return [
      'id', 'email', 'username', 'display_name', 'role',
      'avatar', 'bio', 'phone', 'is_active', 'email_verified',
      'last_login_at', 'email_verified_at', 'preferences', 'metadata',
      'created_at', 'updated_at'
    ];
  }

  /**
   * 应用查询选项
   * @param query 查询构建器
   * @param options 查询选项
   * @returns 修改后的查询构建器
   */
  private static applyQueryOptions(
    query: Knex.QueryBuilder,
    options: UserQueryOptions
  ): Knex.QueryBuilder {
    // 排除已删除的记录（除非明确包含）
    if (!options.includeDeleted) {
      query = query.whereNull('deleted_at');
    }

    // 按角色过滤
    if (options.role) {
      query = query.where('role', options.role);
    }

    // 按激活状态过滤
    if (options.isActive !== undefined) {
      query = query.where('is_active', options.isActive);
    }

    // 按邮箱验证状态过滤
    if (options.emailVerified !== undefined) {
      query = query.where('email_verified', options.emailVerified);
    }

    return query;
  }
}

// 导出用户模型类
export default UserModel;