// src/utils/typescript-helpers.ts - TypeScript辅助函数

/**
 * 安全获取错误消息
 * @param error 错误对象
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
    return String((error as { message: unknown }).message);
  }
  
  return String(error);
}

/**
 * 安全获取错误堆栈
 * @param error 错误对象
 * @returns 错误堆栈字符串或undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  
  if (error && typeof error === 'object' && 'stack' in error) {
    return String((error as { stack: unknown }).stack);
  }
  
  return undefined;
}

/**
 * 检查是否为错误对象
 * @param value 待检查的值
 * @returns 是否为错误对象
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * 安全的JSON字符串化
 * @param value 待序列化的值
 * @param space 缩进空格数
 * @returns JSON字符串
 */
export function safeJsonStringify(value: unknown, space?: number): string {
  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    return String(value);
  }
}

/**
 * 安全的JSON解析
 * @param jsonString JSON字符串
 * @returns 解析后的对象或原始字符串
 */
export function safeJsonParse<T = unknown>(jsonString: string): T | string {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    return jsonString;
  }
}

/**
 * 类型断言辅助函数
 * @param value 待检查的值
 * @param predicate 断言函数
 * @param errorMessage 错误消息
 */
export function assert<T>(
  value: unknown,
  predicate: (value: unknown) => value is T,
  errorMessage: string
): asserts value is T {
  if (!predicate(value)) {
    throw new Error(errorMessage);
  }
}

/**
 * 检查是否为非空值
 * @param value 待检查的值
 * @returns 是否为非空值
 */
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * 延迟执行函数
 * @param ms 延迟毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数包装器
 * @param fn 要重试的函数
 * @param maxRetries 最大重试次数
 * @param delayMs 重试间隔
 * @returns 包装后的函数
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        console.warn(`重试 ${attempt + 1}/${maxRetries}: ${getErrorMessage(error)}`);
        await delay(delayMs * Math.pow(2, attempt)); // 指数退避
      }
    }
  }
  
  throw lastError;
}

/**
 * 超时包装器
 * @param promise 原始Promise
 * @param timeoutMs 超时毫秒数
 * @param errorMessage 超时错误消息
 * @returns 带超时的Promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = `操作超时 (${timeoutMs}ms)`
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}