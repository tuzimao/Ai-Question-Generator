// src/types/base.ts

/**
 * 基础类型定义文件
 * 定义整个应用共用的基础类型和接口
 */

/**
 * 用户角色枚举
 */
export enum UserRole {
  STUDENT = 'student',    // 学生
  TEACHER = 'teacher',    // 教师  
  ADMIN = 'admin'         // 管理员
}

/**
 * 通用状态枚举
 */
export enum Status {
  ACTIVE = 'active',      // 激活
  INACTIVE = 'inactive',  // 未激活
  PENDING = 'pending',    // 待处理
  DELETED = 'deleted'     // 已删除
}

/**
 * API响应基础接口
 */
export interface BaseResponse<T = any> {
  success: boolean;       // 请求是否成功
  message?: string;       // 响应消息
  data?: T;              // 响应数据
  error?: string;        // 错误信息
  timestamp: string;     // 响应时间戳
  requestId?: string;    // 请求ID（用于追踪）
}

/**
 * 分页查询参数接口
 */
export interface PaginationParams {
  page: number;          // 页码（从1开始）
  limit: number;         // 每页数量
  sortBy?: string;       // 排序字段
  sortOrder?: 'asc' | 'desc'; // 排序方向
}

/**
 * 分页查询响应接口
 */
export interface PaginatedResponse<T> {
  data: T[];             // 数据列表
  pagination: {
    current: number;     // 当前页码
    total: number;       // 总数量
    pages: number;       // 总页数
    limit: number;       // 每页数量
    hasNext: boolean;    // 是否有下一页
    hasPrev: boolean;    // 是否有上一页
  };
}

/**
 * 数据库记录基础接口
 */
export interface BaseEntity {
  id: string;            // 主键ID
  created_at: Date;      // 创建时间
  updated_at: Date;      // 更新时间
  deleted_at?: Date;     // 软删除时间（可选）
}

/**
 * 用户基础接口
 */
export interface User extends BaseEntity {
  email: string;         // 邮箱
  username: string;      // 用户名
  display_name: string;  // 显示名称
  password_hash: string; // 密码哈希
  role: UserRole;        // 用户角色
  avatar?: string;       // 头像URL（可选）
  is_active: boolean;    // 是否激活
  last_login_at?: Date;  // 最后登录时间（可选）
  email_verified_at?: Date; // 邮箱验证时间（可选）
}

/**
 * JWT载荷接口
 */
export interface JWTPayload {
  userId: string;        // 用户ID
  role: UserRole;        // 用户角色
  iat: number;          // 签发时间
  exp: number;          // 过期时间
}

/**
 * 请求上下文接口（扩展Fastify Request）
 */
export interface RequestContext {
  user?: User;           // 当前用户（认证后）
  requestId: string;     // 请求ID
  timestamp: Date;       // 请求时间
}

/**
 * 环境变量接口
 */
export interface EnvironmentConfig {
  // 应用配置
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  FRONTEND_URL: string;
  
  // 数据库配置
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  
  // JWT配置
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  
  // 文件上传配置
  UPLOAD_DIR: string;
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string;
  
  // 安全配置
  BCRYPT_ROUNDS: number;
  CORS_ORIGINS: string;
  
  // 可选配置
  REDIS_URL?: string;
  LOG_LEVEL?: string;
  DEBUG_MODE?: string;
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',       // 验证错误
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR', // 认证错误
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',   // 授权错误
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',         // 资源未找到
  CONFLICT_ERROR = 'CONFLICT_ERROR',           // 冲突错误
  DATABASE_ERROR = 'DATABASE_ERROR',           // 数据库错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',           // 内部错误
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR'        // 速率限制错误
}

/**
 * 自定义错误接口
 */
export interface CustomError extends Error {
  type: ErrorType;       // 错误类型
  statusCode: number;    // HTTP状态码
  details?: any;         // 错误详情
  requestId?: string;    // 请求ID
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * 日志记录接口
 */
export interface LogEntry {
  level: LogLevel;       // 日志级别
  message: string;       // 日志消息
  timestamp: Date;       // 时间戳
  requestId?: string;    // 请求ID
  userId?: string;       // 用户ID
  meta?: Record<string, any>; // 额外元数据
}

/**
 * 文件上传信息接口
 */
export interface UploadedFile {
  id: string;            // 文件ID
  filename: string;      // 原始文件名
  mimetype: string;      // MIME类型
  size: number;          // 文件大小（字节）
  path: string;          // 存储路径
  uploaded_at: Date;     // 上传时间
  user_id: string;       // 上传用户ID
}

/**
 * 通用配置接口
 */
export interface AppConfig {
  server: {
    port: number;
    host: string;
    cors: {
      origins: string[];
    };
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
  };
  security: {
    bcryptRounds: number;
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
    uploadDir: string;
  };
}