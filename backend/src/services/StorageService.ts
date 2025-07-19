// src/services/StorageService.ts

import { Client as MinioClient, BucketItem, UploadedObjectInfo } from 'minio';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

/**
 * 文件上传配置接口
 */
export interface UploadConfig {
  bucket: string;
  fileName?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * 文件信息接口
 */
export interface FileInfo {
  id: string;
  bucket: string;
  fileName: string;
  originalName: string;
  size: number;
  contentType: string;
  uploadDate: Date;
  url: string;
  metadata?: Record<string, string>;
}

/**
 * 存储桶配置接口
 */
export interface BucketConfig {
  name: string;
  region?: string;
  versioning?: boolean;
  lifecycle?: any;
}

/**
 * 文件存储服务类
 * 负责管理MinIO对象存储的连接和操作
 */
export class StorageService {
  private client: MinioClient | null = null;
  private readonly endpoint: string;
  private readonly port: number;
  private readonly useSSL: boolean;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private isConnected: boolean = false;
  private initializationError: string | null = null;

  // 默认存储桶配置
  private readonly defaultBuckets = {
    documents: 'documents',    // 用户上传的文档
    uploads: 'uploads',        // 临时上传文件
    avatars: 'avatars',        // 用户头像
    exports: 'exports'         // 导出文件
  };

  constructor() {
    try {
      // 从环境变量读取配置
      this.endpoint = process.env.MINIO_ENDPOINT || 'localhost';
      this.port = parseInt(process.env.MINIO_PORT || '9000', 10);
      this.useSSL = process.env.MINIO_USE_SSL === 'true';
      this.accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
      this.secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';

      console.log(`📁 MinIO存储服务构造完成: ${this.endpoint}:${this.port}`);
    } catch (error) {
      this.initializationError = error.message;
      console.error('❌ MinIO存储服务构造失败:', error);
    }
  }

  /**
   * 初始化存储服务
   * 创建连接并设置默认存储桶
   */
  public async initialize(): Promise<void> {
    try {
      if (this.initializationError) {
        throw new Error(`MinIO存储服务初始化失败: ${this.initializationError}`);
      }

      // 创建MinIO客户端
      this.client = new MinioClient({
        endPoint: this.endpoint,
        port: this.port,
        useSSL: this.useSSL,
        accessKey: this.accessKey,
        secretKey: this.secretKey
      });

      // 测试连接
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        throw new Error('MinIO健康检查失败');
      }

      // 创建默认存储桶
      await this.createDefaultBuckets();

      this.isConnected = true;
      console.log('✅ MinIO存储服务初始化完成');
    } catch (error) {
      console.error('❌ MinIO存储服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   * @returns 是否连接正常
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (this.initializationError) {
        console.warn('MinIO服务初始化失败，健康检查返回false:', this.initializationError);
        return false;
      }

      if (!this.client) {
        // 尝试创建客户端
        this.client = new MinioClient({
          endPoint: this.endpoint,
          port: this.port,
          useSSL: this.useSSL,
          accessKey: this.accessKey,
          secretKey: this.secretKey
        });
      }

      // 尝试列出存储桶
      await this.client.listBuckets();
      return true;
    } catch (error) {
      console.error('MinIO健康检查失败:', error.message);
      return false;
    }
  }

  /**
   * 获取连接状态
   * @returns 是否已连接
   */
  public isConnectedToMinio(): boolean {
    return this.isConnected;
  }

  /**
   * 创建默认存储桶
   */
  private async createDefaultBuckets(): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    for (const [key, bucketName] of Object.entries(this.defaultBuckets)) {
      try {
        const exists = await this.client.bucketExists(bucketName);
        if (!exists) {
          await this.client.makeBucket(bucketName, 'us-east-1');
          console.log(`📦 创建存储桶: ${bucketName}`);
        } else {
          console.log(`✅ 存储桶已存在: ${bucketName}`);
        }
      } catch (error) {
        console.error(`创建存储桶失败 ${bucketName}:`, error);
        throw error;
      }
    }
  }

  /**
   * 上传文件
   * @param stream 文件流
   * @param config 上传配置
   * @returns 文件信息
   */
  public async uploadFile(
    stream: Readable | Buffer,
    config: UploadConfig
  ): Promise<FileInfo> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      // 生成唯一文件名
      const fileId = uuidv4();
      const extension = config.fileName ? path.extname(config.fileName) : '';
      const objectName = config.fileName || `${fileId}${extension}`;

      // 准备元数据
      const metadata = {
        'Content-Type': config.contentType || 'application/octet-stream',
        'Upload-Date': new Date().toISOString(),
        'File-ID': fileId,
        ...config.metadata
      };

      // 上传文件
      let uploadResult: UploadedObjectInfo;
      if (Buffer.isBuffer(stream)) {
        uploadResult = await this.client.putObject(
          config.bucket,
          objectName,
          stream,
          stream.length,
          metadata
        );
      } else {
        uploadResult = await this.client.putObject(
          config.bucket,
          objectName,
          stream,
          undefined,
          metadata
        );
      }

      // 获取文件信息
      const stat = await this.client.statObject(config.bucket, objectName);

      // 生成访问URL
      const url = await this.getFileUrl(config.bucket, objectName);

      const fileInfo: FileInfo = {
        id: fileId,
        bucket: config.bucket,
        fileName: objectName,
        originalName: config.fileName || objectName,
        size: stat.size,
        contentType: stat.metaData['content-type'] || config.contentType || 'application/octet-stream',
        uploadDate: stat.lastModified,
        url,
        metadata: stat.metaData
      };

      console.log(`✅ 文件上传成功: ${objectName} (${stat.size} bytes)`);
      return fileInfo;
    } catch (error) {
      console.error('文件上传失败:', error);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 下载文件
   * @param bucket 存储桶名称
   * @param fileName 文件名
   * @returns 文件流
   */
  public async downloadFile(bucket: string, fileName: string): Promise<Readable> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      const stream = await this.client.getObject(bucket, fileName);
      return stream;
    } catch (error) {
      console.error('文件下载失败:', error);
      throw new Error(`文件下载失败: ${error.message}`);
    }
  }

  /**
   * 获取文件信息
   * @param bucket 存储桶名称
   * @param fileName 文件名
   * @returns 文件信息
   */
  public async getFileInfo(bucket: string, fileName: string): Promise<FileInfo | null> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      const stat = await this.client.statObject(bucket, fileName);
      const url = await this.getFileUrl(bucket, fileName);

      return {
        id: stat.metaData['file-id'] || fileName,
        bucket,
        fileName,
        originalName: stat.metaData['original-name'] || fileName,
        size: stat.size,
        contentType: stat.metaData['content-type'] || 'application/octet-stream',
        uploadDate: stat.lastModified,
        url,
        metadata: stat.metaData
      };
    } catch (error) {
      if (error.code === 'NotFound') {
        return null;
      }
      console.error('获取文件信息失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param bucket 存储桶名称
   * @param fileName 文件名
   * @returns 是否删除成功
   */
  public async deleteFile(bucket: string, fileName: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      await this.client.removeObject(bucket, fileName);
      console.log(`🗑️ 文件删除成功: ${fileName}`);
      return true;
    } catch (error) {
      console.error('文件删除失败:', error);
      return false;
    }
  }

  /**
   * 批量删除文件
   * @param bucket 存储桶名称
   * @param fileNames 文件名数组
   * @returns 删除结果
   */
  public async deleteFiles(
    bucket: string,
    fileNames: string[]
  ): Promise<{ success: string[]; failed: string[] }> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    const success: string[] = [];
    const failed: string[] = [];

    try {
      await this.client.removeObjects(bucket, fileNames);
      success.push(...fileNames);
      console.log(`🗑️ 批量删除成功: ${fileNames.length} 个文件`);
    } catch (error) {
      failed.push(...fileNames);
      console.error('批量删除失败:', error);
    }

    return { success, failed };
  }

  /**
   * 列出文件
   * @param bucket 存储桶名称
   * @param prefix 文件前缀（可选）
   * @param maxKeys 最大返回数量（可选）
   * @returns 文件列表
   */
  public async listFiles(
    bucket: string,
    prefix?: string,
    maxKeys?: number
  ): Promise<FileInfo[]> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      const files: FileInfo[] = [];
      const stream = this.client.listObjects(bucket, prefix, true);

      let count = 0;
      for await (const obj of stream) {
        if (maxKeys && count >= maxKeys) {
          break;
        }

        const url = await this.getFileUrl(bucket, obj.name!);
        files.push({
          id: obj.name!,
          bucket,
          fileName: obj.name!,
          originalName: obj.name!,
          size: obj.size!,
          contentType: 'application/octet-stream', // 需要单独获取
          uploadDate: obj.lastModified!,
          url
        });
        count++;
      }

      return files;
    } catch (error) {
      console.error('列出文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件访问URL
   * @param bucket 存储桶名称
   * @param fileName 文件名
   * @param expiry 过期时间（秒，默认7天）
   * @returns 预签名URL
   */
  public async getFileUrl(
    bucket: string,
    fileName: string,
    expiry: number = 7 * 24 * 60 * 60 // 7天
  ): Promise<string> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      const url = await this.client.presignedGetObject(bucket, fileName, expiry);
      return url;
    } catch (error) {
      console.error('获取文件URL失败:', error);
      throw error;
    }
  }

  /**
   * 获取上传URL（用于前端直接上传）
   * @param bucket 存储桶名称
   * @param fileName 文件名
   * @param expiry 过期时间（秒，默认1小时）
   * @returns 预签名上传URL
   */
  public async getUploadUrl(
    bucket: string,
    fileName: string,
    expiry: number = 60 * 60 // 1小时
  ): Promise<string> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      const url = await this.client.presignedPutObject(bucket, fileName, expiry);
      return url;
    } catch (error) {
      console.error('获取上传URL失败:', error);
      throw error;
    }
  }

  /**
   * 创建存储桶
   * @param config 存储桶配置
   */
  public async createBucket(config: BucketConfig): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      const exists = await this.client.bucketExists(config.name);
      if (!exists) {
        await this.client.makeBucket(config.name, config.region || 'us-east-1');
        console.log(`📦 创建存储桶: ${config.name}`);
      } else {
        console.log(`✅ 存储桶已存在: ${config.name}`);
      }
    } catch (error) {
      console.error(`创建存储桶失败 ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * 删除存储桶
   * @param bucketName 存储桶名称
   */
  public async deleteBucket(bucketName: string): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      await this.client.removeBucket(bucketName);
      console.log(`🗑️ 删除存储桶: ${bucketName}`);
    } catch (error) {
      console.error(`删除存储桶失败 ${bucketName}:`, error);
      throw error;
    }
  }

  /**
   * 获取存储桶列表
   * @returns 存储桶列表
   */
  public async listBuckets(): Promise<BucketItem[]> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      const buckets = await this.client.listBuckets();
      return buckets;
    } catch (error) {
      console.error('获取存储桶列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   * @returns 存储统计
   */
  public async getStorageStats(): Promise<{
    buckets: number;
    totalSize: number;
    fileCount: number;
  }> {
    if (!this.client) {
      throw new Error('MinIO客户端未初始化');
    }

    try {
      const buckets = await this.listBuckets();
      let totalSize = 0;
      let fileCount = 0;

      for (const bucket of buckets) {
        const files = await this.listFiles(bucket.name);
        fileCount += files.length;
        totalSize += files.reduce((sum, file) => sum + file.size, 0);
      }

      return {
        buckets: buckets.length,
        totalSize,
        fileCount
      };
    } catch (error) {
      console.error('获取存储统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认存储桶配置
   * @returns 默认存储桶
   */
  public getDefaultBuckets(): Record<string, string> {
    return { ...this.defaultBuckets };
  }

  /**
   * 关闭连接
   */
  public async close(): Promise<void> {
    // MinIO客户端通常不需要显式关闭连接
    this.isConnected = false;
    this.client = null;
    console.log('📴 MinIO存储服务连接已关闭');
  }
}

/**
 * 创建存储服务单例实例
 * 使用延迟初始化模式，确保安全创建
 */
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}

// 导出单例实例
export const storageService = getStorageService();

// 默认导出类
export default StorageService;