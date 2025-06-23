// frontend/src/types/auth.ts

/**
 * 用户角色枚举
 */
export enum UserRole {
  STUDENT = 'student',    // 学生
  TEACHER = 'teacher',    // 教师
  ADMIN = 'admin'         // 管理员
}

/**
 * 用户接口
 * 定义用户的基本信息
 */
export interface User {
  id: string;              // 用户唯一标识
  username: string;        // 用户名
  email: string;           // 邮箱
  role: UserRole;          // 用户角色
  avatar?: string;         // 头像URL（可选）
  displayName: string;     // 显示名称
  createdAt: Date;         // 注册时间
  lastLoginAt?: Date;      // 最后登录时间
  isActive: boolean;       // 账户是否激活
}

/**
 * 登录请求接口
 */
export interface LoginRequest {
  email: string;           // 邮箱
  password: string;        // 密码
  rememberMe?: boolean;    // 是否记住登录状态
}

/**
 * 注册请求接口
 */
export interface RegisterRequest {
  username: string;        // 用户名
  email: string;           // 邮箱
  password: string;        // 密码
  confirmPassword: string; // 确认密码
  role: UserRole;          // 用户角色
  displayName: string;     // 显示名称
}

/**
 * 认证响应接口
 * 登录成功后返回的数据结构
 */
export interface AuthResponse {
  user: User;              // 用户信息
  token: string;           // JWT令牌
  refreshToken: string;    // 刷新令牌
  expiresIn: number;       // 令牌过期时间（秒）
}

/**
 * 认证状态接口
 * 用于全局状态管理
 */
export interface AuthState {
  user: User | null;       // 当前用户信息
  token: string | null;    // 访问令牌
  isAuthenticated: boolean; // 是否已认证
  isLoading: boolean;      // 是否正在加载
  error: string | null;    // 错误信息
}