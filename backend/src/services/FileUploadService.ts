// src/services/FileUploadService.ts

import crypto from 'crypto';
import path from 'path';
import { Readable } from 'stream';
//import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '@/services/StorageService';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 支持的文件类型枚举
 */
export enum SupportedFileType {
  PDF = 'application/pdf',
  MARKDOWN = 'text/markdown',
  TEXT = 'text/plain',
  MD = 'text/x-markdown'
}

/**
 * 文件验证结果接口
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  normalizedMimeType?: string;
}

/**
 * 文件上传结果接口
 */
export interface FileUploadResult {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  contentHash: string;
  storagePath: string;
  storageBucket: string;
  uploadUrl?: string;
}

/**
 * 文件上传配置接口
 */
export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  storageBucket: string;
  generatePreview?: boolean;
}

/**
 * 文件流信息接口
 */
export interface FileStreamInfo {
  filename: string;
  mimetype: string;
  encoding: string;
  fieldname: string;
  file: Readable;
}

/**
 * 文件上传服务类
 * 提供文件上传、验证、存储等核心功能
 */
export class FileUploadService {
  private static readonly DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly DEFAULT_STORAGE_BUCKET = 'documents';
  
  // 支持的文件类型映射
  private static readonly MIME_TYPE_MAP: Record<string, string> = {
    '.pdf': SupportedFileType.PDF,
    '.md': SupportedFileType.MARKDOWN,
    '.markdown': SupportedFileType.MARKDOWN,
    '.txt': SupportedFileType.TEXT,
    'application/pdf': SupportedFileType.PDF,
    'text/markdown': SupportedFileType.MARKDOWN,
    'text/x-markdown': SupportedFileType.MARKDOWN,
    'text/plain': SupportedFileType.TEXT
  };

  /**
   * 获取默认上传配置
   * @returns 默认配置
   */
  public static getDefaultConfig(): FileUploadConfig {
    return {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || String(this.DEFAULT_MAX_FILE_SIZE), 10),
      allowedMimeTypes: Object.values(SupportedFileType),
      storageBucket: process.env.UPLOAD_BUCKET || this.DEFAULT_STORAGE_BUCKET,
      generatePreview: false
    };
  }

  /**
   * 验证文件（不验证大小，适用于流式处理）
   * @param filename 文件名
   * @param mimetype MIME类型
   * @param config 上传配置
   * @returns 验证结果
   */
  public static validateFileWithoutSize(
    filename: string,
    mimetype: string,
    config: FileUploadConfig = this.getDefaultConfig()
  ): FileValidationResult {
    try {
      // 检查文件名
      if (!filename || filename.trim() === '') {
        return { isValid: false, error: '文件名不能为空' };
      }

      // 标准化MIME类型
      const normalizedMimeType = this.normalizeMimeType(filename, mimetype);
      
      // 检查文件类型
      if (!config.allowedMimeTypes.includes(normalizedMimeType)) {
        return { 
          isValid: false, 
          error: `不支持的文件类型：${normalizedMimeType}。支持的类型：${config.allowedMimeTypes.join(', ')}` 
        };
      }

      // 检查文件扩展名
      const ext = path.extname(filename).toLowerCase();
      const validExtensions = ['.pdf', '.md', '.markdown', '.txt'];
      if (!validExtensions.includes(ext)) {
        return { 
          isValid: false, 
          error: `不支持的文件扩展名：${ext}。支持的扩展名：${validExtensions.join(', ')}` 
        };
      }

      return { 
        isValid: true, 
        normalizedMimeType 
      };
    } catch (error) {
      console.error('文件验证失败:', error);
      return { 
        isValid: false, 
        error: `文件验证失败: ${getErrorMessage(error)}` 
      };
    }
  }

  /**
   * 验证文件（包括大小验证）
   * @param filename 文件名
   * @param mimetype MIME类型
   * @param size 文件大小
   * @param config 上传配置
   * @returns 验证结果
   */
  public static validateFile(
    filename: string,
    mimetype: string,
    size: number,
    config: FileUploadConfig = this.getDefaultConfig()
  ): FileValidationResult {
    // 先进行基础验证
    const basicValidation = this.validateFileWithoutSize(filename, mimetype, config);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // 检查文件大小
    if (size <= 0) {
      return { isValid: false, error: '文件大小无效' };
    }

    if (size > config.maxFileSize) {
      const maxSizeMB = Math.round(config.maxFileSize / (1024 * 1024));
      return { 
        isValid: false, 
        error: `文件大小超过限制，最大允许 ${maxSizeMB}MB` 
      };
    }

    return basicValidation;
  }

  /**
   * 上传文件到存储服务
   * @param fileStream 文件流信息
   * @param userId 用户ID
   * @param config 上传配置
   * @returns 上传结果
   */
  public static async uploadFile(
    fileStream: FileStreamInfo,
    userId: string,
    config: FileUploadConfig = this.getDefaultConfig()
  ): Promise<FileUploadResult> {
    let tempBuffer: Buffer | null = null;
    
    try {
      console.log(`📤 开始上传文件: ${fileStream.filename} (用户: ${userId})`);

      // 🔧 修复：先进行基础验证（不包括文件大小）
      const basicValidation = this.validateFileWithoutSize(
        fileStream.filename,
        fileStream.mimetype,
        config
      );

      if (!basicValidation.isValid) {
        throw new Error(basicValidation.error);
      }

      console.log('✅ 基础文件验证通过');

      // 流式读取文件内容并计算哈希
      const { buffer, contentHash, size } = await this.processFileStream(
        fileStream.file,
        config.maxFileSize
      );
      tempBuffer = buffer;

      console.log(`📊 文件读取完成: ${size} 字节, 哈希: ${contentHash.substring(0, 16)}...`);

      // 🔧 修复：现在验证实际的文件大小
      const sizeValidation = this.validateFile(
        fileStream.filename,
        fileStream.mimetype,
        size,
        config
      );

      if (!sizeValidation.isValid) {
        throw new Error(sizeValidation.error);
      }

      console.log('✅ 文件大小验证通过');

      // 生成存储路径
      const fileId = uuidv4();
      const ext = path.extname(fileStream.filename);
      const storagePath = this.generateStoragePath(userId, fileId, ext);

      // 上传到MinIO
      console.log(`📁 上传到存储服务: ${storagePath}`);
      const uploadResult = await storageService.uploadFile(buffer, {
        bucket: config.storageBucket,
        fileName: storagePath,
        contentType: basicValidation.normalizedMimeType!,
        metadata: {
          'original-name': fileStream.filename,
          'user-id': userId,
          'file-id': fileId,
          'content-hash': contentHash,
          'upload-timestamp': new Date().toISOString()
        }
      });

      console.log(`✅ 文件上传成功: ${fileStream.filename} -> ${storagePath}`);

      return {
        fileId,
        originalName: fileStream.filename,
        mimeType: basicValidation.normalizedMimeType!,
        size,
        contentHash,
        storagePath,
        storageBucket: config.storageBucket,
        uploadUrl: uploadResult.url
      };

    } catch (error) {
      console.error('文件上传失败:', error);
      throw new Error(`文件上传失败: ${getErrorMessage(error)}`);
    } finally {
      // 清理临时缓冲区
      if (tempBuffer) {
        tempBuffer = null;
      }
    }
  }

  /**
   * 流式处理文件并计算哈希（带大小限制）
   * @param fileStream 文件流
   * @param maxFileSize 最大文件大小
   * @returns 文件缓冲区、哈希值和大小
   */
  private static async processFileStream(
    fileStream: Readable, 
    maxFileSize: number = this.DEFAULT_MAX_FILE_SIZE
  ): Promise<{
    buffer: Buffer;
    contentHash: string;
    size: number;
  }> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const hash = crypto.createHash('sha256');
      let size = 0;

      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('文件读取超时'));
      }, 300000); // 5分钟超时

      const cleanup = () => {
        clearTimeout(timeout);
      };

      fileStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        hash.update(chunk);
        size += chunk.length;

        // 🔧 修复：实时检查文件大小，防止内存溢出
        if (size > maxFileSize) {
          cleanup();
          reject(new Error(`文件过大，超过 ${Math.round(maxFileSize / (1024 * 1024))}MB 限制`));
          return;
        }
      });

      fileStream.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const contentHash = hash.digest('hex');
          cleanup();
          resolve({ buffer, contentHash, size });
        } catch (error) {
          cleanup();
          reject(error);
        }
      });

      fileStream.on('error', (error) => {
        cleanup();
        reject(error);
      });
    });
  }

  /**
   * 生成存储路径
   * @param userId 用户ID
   * @param fileId 文件ID
   * @param extension 文件扩展名
   * @returns 存储路径
   */
  private static generateStoragePath(userId: string, fileId: string, extension: string): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    
    // 路径格式: users/{userId}/{year}/{month}/{day}/{fileId}{extension}
    return `users/${userId}/${year}/${month}/${day}/${fileId}${extension}`;
  }

  /**
   * 标准化MIME类型
   * @param filename 文件名
   * @param mimetype 原始MIME类型
   * @returns 标准化的MIME类型
   */
  private static normalizeMimeType(filename: string, mimetype: string): string {
    // 优先使用文件扩展名判断
    const ext = path.extname(filename).toLowerCase();
    const extMimeType = this.MIME_TYPE_MAP[ext];
    
    if (extMimeType) {
      return extMimeType;
    }

    // 使用原始MIME类型
    const normalizedMimeType = this.MIME_TYPE_MAP[mimetype.toLowerCase()];
    if (normalizedMimeType) {
      return normalizedMimeType;
    }

    // 默认返回原始类型
    return mimetype;
  }

  /**
   * 删除上传的文件
   * @param storageBucket 存储桶
   * @param storagePath 存储路径
   * @returns 是否删除成功
   */
  public static async deleteUploadedFile(
    storageBucket: string,
    storagePath: string
  ): Promise<boolean> {
    try {
      const success = await storageService.deleteFile(storageBucket, storagePath);
      if (success) {
        console.log(`🗑️ 已删除上传文件: ${storagePath}`);
      }
      return success;
    } catch (error) {
      console.error('删除上传文件失败:', error);
      return false;
    }
  }

  /**
   * 获取文件下载URL
   * @param storageBucket 存储桶
   * @param storagePath 存储路径
   * @param expirySeconds 过期时间（秒）
   * @returns 下载URL
   */
  public static async getFileDownloadUrl(
    storageBucket: string,
    storagePath: string,
    expirySeconds: number = 3600 // 1小时
  ): Promise<string> {
    try {
      return await storageService.getFileUrl(storageBucket, storagePath, expirySeconds);
    } catch (error) {
      console.error('获取文件下载URL失败:', error);
      throw new Error(`获取文件下载URL失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 计算文件哈希（用于外部文件）
   * @param filePath 文件路径
   * @returns 文件哈希
   */
  public static async calculateFileHash(filePath: string): Promise<string> {
    try {
      // 从存储服务获取文件
      const fileStream = await storageService.downloadFile('documents', filePath);
      
      return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        
        fileStream.on('data', (chunk) => {
          hash.update(chunk);
        });
        
        fileStream.on('end', () => {
          resolve(hash.digest('hex'));
        });
        
        fileStream.on('error', reject);
      });
    } catch (error) {
      console.error('计算文件哈希失败:', error);
      throw new Error(`计算文件哈希失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 验证上传配置
   * @param config 上传配置
   * @returns 是否有效
   */
  public static validateUploadConfig(config: FileUploadConfig): boolean {
    try {
      if (config.maxFileSize <= 0 || config.maxFileSize > 100 * 1024 * 1024) {
        console.error('上传配置无效: 文件大小限制超出范围');
        return false;
      }

      if (!config.allowedMimeTypes || config.allowedMimeTypes.length === 0) {
        console.error('上传配置无效: 未指定允许的文件类型');
        return false;
      }

      if (!config.storageBucket || config.storageBucket.trim() === '') {
        console.error('上传配置无效: 未指定存储桶');
        return false;
      }

      return true;
    } catch (error) {
      console.error('验证上传配置失败:', error);
      return false;
    }
  }

  /**
   * 获取文件类型描述
   * @param mimeType MIME类型
   * @returns 类型描述
   */
  public static getFileTypeDescription(mimeType: string): string {
    const descriptions: Record<string, string> = {
      [SupportedFileType.PDF]: 'PDF文档',
      [SupportedFileType.MARKDOWN]: 'Markdown文档',
      [SupportedFileType.TEXT]: '纯文本文档'
    };

    return descriptions[mimeType] || '未知文件类型';
  }

  /**
   * 生成文件预览信息
   * @param uploadResult 上传结果
   * @returns 预览信息
   */
  public static generateFilePreview(uploadResult: FileUploadResult): Record<string, any> {
    return {
      fileId: uploadResult.fileId,
      originalName: uploadResult.originalName,
      typeDescription: this.getFileTypeDescription(uploadResult.mimeType),
      sizeFormatted: this.formatFileSize(uploadResult.size),
      mimeType: uploadResult.mimeType,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化的大小字符串
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// 导出服务类
export default FileUploadService;