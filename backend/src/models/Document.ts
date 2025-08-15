// src/models/Document.ts

import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '@/utils/database';
import { BaseEntity } from '@/types/base';

/**
 * 文档处理状态枚举
 */
export enum DocumentIngestStatus {
  UPLOADING = 'uploading',   // 上传中
  UPLOADED = 'uploaded',     // 上传完成
  PARSING = 'parsing',       // 解析中
  PARSED = 'parsed',         // 解析完成
  CHUNKING = 'chunking',     // 分块处理中
  CHUNKED = 'chunked',       // 分块完成
  EMBEDDING = 'embedding',   // 向量化中(Milestone 2)
  READY = 'ready',           // 完全就绪，可用于检索
  FAILED = 'failed'          // 处理失败
}

/**
 * 文档基础接口
 */
export interface Document extends BaseEntity {
  doc_id: string;
  user_id: string;
  filename: string;
  content_hash: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  storage_bucket: string;
  
  // 解析结果字段
  page_count?: number;
  language?: string;
  text_length?: number;
  token_estimate?: number;
  
  // 处理状态
  ingest_status: DocumentIngestStatus;
  error_message?: string;
  processing_log?: string;
  
  // 时间戳
  parsing_started_at?: Date;
  parsing_completed_at?: Date;
  chunking_started_at?: Date;
  chunking_completed_at?: Date;
  
  // 扩展字段
  metadata?: Record<string, any>;
  parse_config?: Record<string, any>;
  chunk_config?: Record<string, any>;
}

/**
 * 创建文档请求接口
 */
export interface CreateDocumentRequest {
  user_id: string;
  filename: string;
  content_hash: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  storage_bucket?: string;
  metadata?: Record<string, any>;
  parse_config?: Record<string, any>;
  chunk_config?: Record<string, any>;
}

/**
 * 更新文档请求接口
 */
export interface UpdateDocumentRequest {
  filename?: string;
  page_count?: number;
  language?: string;
  text_length?: number;
  token_estimate?: number;
  ingest_status?: DocumentIngestStatus;
  error_message?: string;
  processing_log?: string;
  metadata?: Record<string, any>;
  parse_config?: Record<string, any>;
  chunk_config?: Record<string, any>;
}

/**
 * 文档查询选项接口
 */
export interface DocumentQueryOptions {
  includeDeleted?: boolean;
  status?: DocumentIngestStatus;
  mimeType?: string;
  userId?: string;
  language?: string;
  minSize?: number;
  maxSize?: number;
  sortBy?: 'created_at' | 'updated_at' | 'filename' | 'size_bytes';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 文档统计信息接口
 */
export interface DocumentStats {
  total: number;
  byStatus: Record<DocumentIngestStatus, number>;
  byMimeType: Record<string, number>;
  totalSize: number;
  avgTokens: number;
}

/**
 * 文档模型类
 * 提供文档相关的数据库操作方法
 */
export class DocumentModel {
  private static readonly TABLE_NAME = 'documents';

  /**
   * 创建新文档记录
   * @param docData 文档数据
   * @param trx 可选的数据库事务
   * @returns 创建的文档信息
   */
  public static async create(
    docData: CreateDocumentRequest,
    trx?: Knex.Transaction
  ): Promise<Document> {
    const dbInstance = trx || db;

    try {
      // 检查文档是否已存在（基于用户ID和内容哈希）
      const existingDoc = await this.findByUserAndHash(
        docData.user_id, 
        docData.content_hash,
        { includeDeleted: true }
      );

      if (existingDoc) {
        // 如果文档已存在但被软删除，可以选择恢复
        if (existingDoc.deleted_at) {
          return await this.restore(existingDoc.doc_id, trx);
        }
        throw new Error('文档已存在，内容哈希重复');
      }

      // 生成文档ID
      const docId = uuidv4();
      
      // 准备文档记录
      const documentRecord = {
        doc_id: docId,
        user_id: docData.user_id,
        filename: docData.filename.trim(),
        content_hash: docData.content_hash,
        mime_type: docData.mime_type,
        size_bytes: docData.size_bytes,
        storage_path: docData.storage_path,
        storage_bucket: docData.storage_bucket || 'documents',
        ingest_status: DocumentIngestStatus.UPLOADED,
         metadata: this.prepareJSONField(docData.metadata),
        parse_config: this.prepareJSONField(docData.parse_config),
        chunk_config: this.prepareJSONField(docData.chunk_config),
        created_at: new Date(),
        updated_at: new Date()
      };

      


      // 插入文档记录
      await dbInstance(this.TABLE_NAME).insert(documentRecord);

      // 返回创建的文档信息
      const createdDoc = await this.findByIdWithTransaction(docId, dbInstance);
      if (!createdDoc) {
        throw new Error('文档创建失败');
      }

      return createdDoc;
    } catch (error) {
      console.error('文档创建失败:', error);
      throw error;
    }
  }

/**
 * 🔧 新增：安全准备JSON字段用于数据库插入
 * @param value 要存储的值
 * @returns 适合数据库存储的值
 */
private static prepareJSONField(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  // 如果数据库字段类型是JSON，可以直接传入对象
  // 如果是TEXT字段，需要序列化
  // 这里我们先尝试直接传入对象，如果失败再改为字符串
  return value;
}

  /**
   * 根据ID查找文档
   * @param docId 文档ID
   * @param options 查询选项
   * @returns 文档信息
   */
  public static async findById(
    docId: string,
    options: DocumentQueryOptions = {}
  ): Promise<Document | null> {
    try {
      let query = db(this.TABLE_NAME)
        .where('doc_id', docId);

      query = this.applyQueryOptions(query, options);

      const doc = await query.first();
      if (!doc) return null;

      return this.formatDocument(doc);
    } catch (error) {
      console.error('查找文档失败:', error);
      throw error;
    }
  }


  /**
   * 应用查询选项到查询构建器
   * @param query 查询构建器
   * @param options 查询选项
   * @returns 更新后的查询构建器
   */
private static async findByIdWithTransaction(
  docId: string,
  dbInstance: Knex | Knex.Transaction,
  options: DocumentQueryOptions = {}
): Promise<Document | null> {
  try {
    let query = dbInstance(this.TABLE_NAME)
      .where('doc_id', docId);

    // 应用查询选项（但不使用全局 db 实例）
    if (!options.includeDeleted) {
      query = query.whereNull('deleted_at');
    }

    if (options.status) {
      query = query.where('ingest_status', options.status);
    }

    if (options.mimeType) {
      query = query.where('mime_type', options.mimeType);
    }

    if (options.userId) {
      query = query.where('user_id', options.userId);
    }

    if (options.language) {
      query = query.where('language', options.language);
    }

    if (options.minSize !== undefined) {
      query = query.where('size_bytes', '>=', options.minSize);
    }
    if (options.maxSize !== undefined) {
      query = query.where('size_bytes', '<=', options.maxSize);
    }

    const doc = await query.first();
    if (!doc) return null;

    return this.formatDocument(doc);
  } catch (error) {
    console.error('查找文档失败:', error);
    throw error;
  }
}

  /**
   * 根据用户ID和内容哈希查找文档
   * @param userId 用户ID
   * @param contentHash 内容哈希
   * @param options 查询选项
   * @returns 文档信息
   */
  public static async findByUserAndHash(
    userId: string,
    contentHash: string,
    options: DocumentQueryOptions = {}
  ): Promise<Document | null> {
    try {
      let query = db(this.TABLE_NAME)
        .where('user_id', userId)
        .where('content_hash', contentHash);

      query = this.applyQueryOptions(query, options);

      const doc = await query.first();
      if (!doc) return null;

      return this.formatDocument(doc);
    } catch (error) {
      console.error('查找文档失败:', error);
      throw error;
    }
  }

  /**
   * 根据用户ID获取文档列表
   * @param userId 用户ID
   * @param options 查询选项
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 文档列表
   */
  public static async findByUser(
    userId: string,
    options: DocumentQueryOptions = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<Document[]> {
    try {
      let query = db(this.TABLE_NAME)
        .where('user_id', userId);

      query = this.applyQueryOptions(query, options);
      
      // 排序
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      query = query.orderBy(sortBy, sortOrder);

      // 分页
      query = query.limit(limit).offset(offset);

      const docs = await query;
      return docs.map(doc => this.formatDocument(doc));
    } catch (error) {
      console.error('查找用户文档失败:', error);
      throw error;
    }
  }

  /**
   * 更新文档信息
   * @param docId 文档ID
   * @param updates 更新数据
   * @param trx 可选的数据库事务
   * @returns 更新后的文档信息
   */
  public static async update(
    docId: string,
    updates: UpdateDocumentRequest,
    trx?: Knex.Transaction
  ): Promise<Document | null> {
    const dbInstance = trx || db;

    try {
      // 检查文档是否存在
      const existingDoc = await this.findById(docId);
      if (!existingDoc) {
        throw new Error('文档不存在');
      }

      // 准备更新数据
      const updateData: any = {
        ...updates,
        updated_at: new Date()
      };

      // 处理JSON字段
      if (updates.metadata !== undefined) {
        updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
      }
      if (updates.parse_config !== undefined) {
        updateData.parse_config = updates.parse_config ? JSON.stringify(updates.parse_config) : null;
      }
      if (updates.chunk_config !== undefined) {
        updateData.chunk_config = updates.chunk_config ? JSON.stringify(updates.chunk_config) : null;
      }

      // 清理undefined值
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // 执行更新
      await dbInstance(this.TABLE_NAME)
        .where('doc_id', docId)
        .update(updateData);

      // 返回更新后的文档信息
      return await this.findById(docId);
    } catch (error) {
      console.error('更新文档失败:', error);
      throw error;
    }
  }

  /**
   * 更新文档处理状态
   * @param docId 文档ID
   * @param status 新状态
   * @param errorMessage 错误信息（可选）
   * @param trx 可选的数据库事务
   * @returns 是否更新成功
   */
  public static async updateStatus(
    docId: string,
    status: DocumentIngestStatus,
    errorMessage?: string,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const updateData: any = {
        ingest_status: status,
        updated_at: new Date()
      };

      // 根据状态设置时间戳
      switch (status) {
        case DocumentIngestStatus.PARSING:
          updateData.parsing_started_at = new Date();
          break;
        case DocumentIngestStatus.PARSED:
          updateData.parsing_completed_at = new Date();
          break;
        case DocumentIngestStatus.CHUNKING:
          updateData.chunking_started_at = new Date();
          break;
        case DocumentIngestStatus.CHUNKED:
          updateData.chunking_completed_at = new Date();
          break;
        case DocumentIngestStatus.FAILED:
          updateData.error_message = errorMessage || 'Processing failed';
          break;
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const result = await dbInstance(this.TABLE_NAME)
        .where('doc_id', docId)
        .update(updateData);

      return result > 0;
    } catch (error) {
      console.error('更新文档状态失败:', error);
      throw error;
    }
  }

  /**
   * 软删除文档
   * @param docId 文档ID
   * @param trx 可选的数据库事务
   * @returns 是否删除成功
   */
  public static async softDelete(docId: string, trx?: Knex.Transaction): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const result = await dbInstance(this.TABLE_NAME)
        .where('doc_id', docId)
        .whereNull('deleted_at')
        .update({
          deleted_at: new Date(),
          updated_at: new Date()
        });

      return result > 0;
    } catch (error) {
      console.error('删除文档失败:', error);
      throw error;
    }
  }

  /**
   * 恢复已删除的文档
   * @param docId 文档ID
   * @param trx 可选的数据库事务
   * @returns 恢复后的文档信息
   */
  public static async restore(docId: string, trx?: Knex.Transaction): Promise<Document> {
    const dbInstance = trx || db;

    try {
      await dbInstance(this.TABLE_NAME)
        .where('doc_id', docId)
        .update({
          deleted_at: null,
          updated_at: new Date()
        });

      const restoredDoc = await this.findById(docId, { includeDeleted: false });
      if (!restoredDoc) {
        throw new Error('文档恢复失败');
      }

      return restoredDoc;
    } catch (error) {
      console.error('恢复文档失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户文档统计信息
   * @param userId 用户ID
   * @returns 统计信息
   */
  public static async getStats(userId: string): Promise<DocumentStats> {
    try {
      // 获取基础统计
      const [totalResult] = await db(this.TABLE_NAME)
        .where('user_id', userId)
        .whereNull('deleted_at')
        .count('doc_id as total')
        .sum('size_bytes as totalSize')
        .avg('token_estimate as avgTokens');

      // 按状态统计
      const statusStats = await db(this.TABLE_NAME)
        .where('user_id', userId)
        .whereNull('deleted_at')
        .select('ingest_status')
        .count('doc_id as count')
        .groupBy('ingest_status');

      // 按类型统计
      const mimeTypeStats = await db(this.TABLE_NAME)
        .where('user_id', userId)
        .whereNull('deleted_at')
        .select('mime_type')
        .count('doc_id as count')
        .groupBy('mime_type');

      // 格式化结果
      const byStatus: Record<DocumentIngestStatus, number> = {} as any;
      Object.values(DocumentIngestStatus).forEach(status => {
        byStatus[status] = 0;
      });
      statusStats.forEach(stat => {
        byStatus[stat.ingest_status as DocumentIngestStatus] = Number(stat.count);
      });

      const byMimeType: Record<string, number> = {};
      mimeTypeStats.forEach(stat => {
        if (stat.mime_type !== undefined) {
          byMimeType[stat.mime_type] = Number(stat.count);
        }
      });

      return {
        total: Number(totalResult?.total) || 0,
        byStatus,
        byMimeType,
        totalSize: Number(totalResult?.totalSize) || 0,
        avgTokens: Number(totalResult?.avgTokens) || 0
      };
    } catch (error) {
      console.error('获取文档统计失败:', error);
      throw error;
    }
  }

  /**
   * 生成内容哈希
   * @param content Buffer或字符串内容
   * @returns SHA256哈希值
   */
  public static generateContentHash(content: Buffer | string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 应用查询选项
   * @param query 查询构建器
   * @param options 查询选项
   * @returns 修改后的查询构建器
   */
  private static applyQueryOptions(
    query: Knex.QueryBuilder,
    options: DocumentQueryOptions
  ): Knex.QueryBuilder {
    // 排除已删除的记录（除非明确包含）
    if (!options.includeDeleted) {
      query = query.whereNull('deleted_at');
    }

    // 按状态过滤
    if (options.status) {
      query = query.where('ingest_status', options.status);
    }

    // 按MIME类型过滤
    if (options.mimeType) {
      query = query.where('mime_type', options.mimeType);
    }

    // 按用户过滤
    if (options.userId) {
      query = query.where('user_id', options.userId);
    }

    // 按语言过滤
    if (options.language) {
      query = query.where('language', options.language);
    }

    // 按文件大小过滤
    if (options.minSize !== undefined) {
      query = query.where('size_bytes', '>=', options.minSize);
    }
    if (options.maxSize !== undefined) {
      query = query.where('size_bytes', '<=', options.maxSize);
    }

    return query;
  }

  /**
   * 格式化文档对象
   * @param doc 原始文档数据
   * @returns 格式化后的文档对象
   */
  private static formatDocument(doc: any): Document {
    return {
      ...doc,
      // 🔧 修复：安全解析JSON字段，处理MySQL JSON类型自动解析的情况
      metadata: this.safeParseJSON(doc.metadata),
      parse_config: this.safeParseJSON(doc.parse_config),
      chunk_config: this.safeParseJSON(doc.chunk_config),
      // 确保数字类型
      size_bytes: Number(doc.size_bytes),
      page_count: doc.page_count ? Number(doc.page_count) : undefined,
      text_length: doc.text_length ? Number(doc.text_length) : undefined,
      token_estimate: doc.token_estimate ? Number(doc.token_estimate) : undefined
    };
  }

  /**
 * 🔧 新增：安全解析JSON字段
 * @param value 可能是字符串、对象或null的值
 * @returns 解析后的对象或undefined
 */
private static safeParseJSON(value: any): any {
  // 如果是null或undefined，返回undefined
  if (value === null || value === undefined) {
    return undefined;
  }
  
  // 如果已经是对象，直接返回（MySQL JSON字段会自动解析）
  if (typeof value === 'object') {
    return value;
  }
  
  // 如果是字符串，尝试解析
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('JSON解析失败:', { value, error: (error as Error).message });
      return undefined;
    }
  }
  
  // 其他类型直接返回
  return value;
}
  
}

// 导出文档模型类
export default DocumentModel;