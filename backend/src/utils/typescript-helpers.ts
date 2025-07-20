// src/utils/typescript-helpers.ts
// TypeScript 辅助工具函数，解决常见的类型安全问题

/**
 * 安全获取错误消息
 * 解决 TypeScript 4.x+ 严格模式下 catch 的 error 参数类型为 unknown 的问题
 * 
 * @param error - 未知类型的错误对象
 * @returns 错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  
  return String(error);
}

/**
 * 安全获取错误堆栈
 * 
 * @param error - 未知类型的错误对象
 * @returns 错误堆栈字符串，如果没有则返回null
 */
export function getErrorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  
  return null;
}

/**
 * 安全获取错误代码
 * 
 * @param error - 未知类型的错误对象
 * @returns 错误代码字符串，如果没有则返回null
 */
export function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as any).code);
  }
  
  return null;
}

/**
 * 创建标准化的错误信息对象
 * 
 * @param error - 未知类型的错误对象
 * @returns 标准化的错误信息
 */
export interface StandardError {
  message: string;
  stack: string | undefined;
  code: string | undefined;
  originalError: unknown;
}

export function createStandardError(error: unknown): StandardError {
  return {
    message: getErrorMessage(error),
    stack: getErrorStack(error) || undefined,
    code: getErrorCode(error) || undefined,
    originalError: error
  };
}

/**
 * Null 安全检查器
 * 解决 "Object is possibly 'null'" 问题
 * 
 * @param value - 可能为 null 或 undefined 的值
 * @param errorMessage - 当值为 null/undefined 时抛出的错误消息
 * @returns 非 null 的值
 * @throws Error 当值为 null 或 undefined 时
 */
export function assertNotNull<T>(value: T | null | undefined, errorMessage: string): T {
  if (value === null || value === undefined) {
    throw new Error(errorMessage);
  }
  return value;
}

/**
 * 安全的可选链操作
 * 
 * @param obj - 可能为 null 的对象
 * @param accessor - 访问器函数
 * @param defaultValue - 默认值
 * @returns 访问结果或默认值
 */
export function safeAccess<T, R>(
  obj: T | null | undefined,
  accessor: (obj: T) => R,
  defaultValue: R
): R {
  if (obj === null || obj === undefined) {
    return defaultValue;
  }
  
  try {
    return accessor(obj);
  } catch {
    return defaultValue;
  }
}

/**
 * 安全的 JSON 解析
 * 
 * @param jsonString - JSON 字符串
 * @param defaultValue - 解析失败时的默认值
 * @returns 解析结果或默认值
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) {
    return defaultValue;
  }
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn('JSON解析失败:', getErrorMessage(error));
    return defaultValue;
  }
}

/**
 * 安全的数字转换
 * 
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 转换结果或默认值
 */
export function safeParseInt(value: string | number | null | undefined, defaultValue: number): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : Math.floor(value);
  }
  
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 安全的浮点数转换
 * 
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 转换结果或默认值
 */
export function safeParseFloat(value: string | number | null | undefined, defaultValue: number): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : value;
  }
  
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 安全的布尔值转换
 * 
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 转换结果或默认值
 */
export function safeParseBool(value: any, defaultValue: boolean): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    const lowered = value.toLowerCase().trim();
    if (lowered === 'true' || lowered === '1' || lowered === 'yes') {
      return true;
    }
    if (lowered === 'false' || lowered === '0' || lowered === 'no' || lowered === '') {
      return false;
    }
  }
  
  if (typeof value === 'number') {
    return value !== 0;
  }
  
  return defaultValue;
}

/**
 * 类型守卫：检查对象是否有指定属性
 * 
 * @param obj - 要检查的对象
 * @param property - 属性名
 * @returns 是否有该属性
 */
export function hasProperty<T, K extends string>(
  obj: T,
  property: K
): obj is T & Record<K, unknown> {
  return obj !== null && obj !== undefined && typeof obj === 'object' && property in obj;
}

/**
 * 安全的数组访问
 * 
 * @param array - 数组
 * @param index - 索引
 * @param defaultValue - 默认值
 * @returns 数组元素或默认值
 */
export function safeArrayAccess<T>(
  array: T[] | null | undefined,
  index: number,
  defaultValue: T
): T {
  if (!array || index < 0 || index >= array.length) {
    return defaultValue;
  }
  
  return array[index] ?? defaultValue;
}

/**
 * Promise 错误处理包装器
 * 
 * @param promise - 要包装的 Promise
 * @returns 包装后的 Promise，错误被转换为 StandardError
 */
export async function safePromise<T>(promise: Promise<T>): Promise<{ data?: T; error?: StandardError }> {
  try {
    const data = await promise;
    return { data };
  } catch (error) {
    return { error: createStandardError(error) };
  }
}

/**
 * 重试机制包装器
 * 
 * @param fn - 要重试的函数
 * @param maxAttempts - 最大重试次数
 * @param delay - 重试延迟（毫秒）
 * @returns Promise 结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        break;
      }
      
      console.warn(`重试 ${attempt}/${maxAttempts} 失败:`, getErrorMessage(error));
      
      // 指数退避延迟
      const currentDelay = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }
  
  throw lastError;
}

/**
 * 环境变量安全读取
 * 
 * @param key - 环境变量键名
 * @param defaultValue - 默认值
 * @returns 环境变量值或默认值
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`环境变量 ${key} 未设置且无默认值`);
  }
  
  return value;
}

/**
 * 安全的环境变量数字读取
 * 
 * @param key - 环境变量键名
 * @param defaultValue - 默认值
 * @returns 数字值
 */
export function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return safeParseInt(value, defaultValue);
}

/**
 * 安全的环境变量布尔值读取
 * 
 * @param key - 环境变量键名
 * @param defaultValue - 默认值
 * @returns 布尔值
 */
export function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  return safeParseBool(value, defaultValue);
}