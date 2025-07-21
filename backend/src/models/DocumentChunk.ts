// src/models/DocumentChunk.ts

import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/utils/database';
import { BaseEntity } from '@/types/base';

/**
 * 分块策略枚举
 */
export enum ChunkingStrategy {
  FIXED_SIZE = 'fixed_size',   // 固定大小分块
  SEMANTIC = 'semantic',       // 语义分块
  HYBRID = 'hybrid'           // 混合策略
}

/**
 * 块类型枚举
 */
export enum ChunkType {
  NORMAL = 'normal',     // 普通文本块
  TITLE = 'title',       // 标题块
  LIST = 'list',         // 列表块
  TABLE = 'table',       // 表格块
  CODE = 'code',         // 代码块
  QUOTE = 'quote',       // 引用块
  FORMULA = 'formula'    // 公式块
}

/**
 * 向量化状态枚举
 */
export enum EmbeddingStatus {
  PENDING = 'pending',      // 待向量化
  PROCESSING = 'processing', // 向量化中
  COMPLETED = 'completed',  // 已完成
  FAILED = 'failed'         // 向量化失败
}

/**
 * 页面跨度信息接口
 */
export interface PageSpan {
  start: number;
  end: number;
  primary: number;
}

/**
 * 重叠信息接口
 */
export interface OverlapInfo {
  chunk_id: string;
  overlap_chars: number;
  overlap_tokens?: number;
}

/**
 * 分块配置接口
 */
export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  targetTokens: number;
  maxTokens: number;
  overlapTokens: number;
  respectBoundaries: boolean;
  minChunkSize?: number;
  [key: string]: any;
}

/**
 * 关键词和实体接口
 */
export interface ExtractedKeywords {
  keywords: string[];
  scores?: number[];
}

export interface ExtractedEntities {
  persons?: string[];
  organizations?: string[];
  locations?: string[];
  concepts?: string[];
  [key: string]: string[] | undefined;
}

/**
 * 文档块基础接口
 */
export interface DocumentChunk extends BaseEntity {
  chunk_id: string;
  doc_id: string;
  section_id?: string;
  
  // 块序号和位置信息
  chunk_index: number;
  start_char: number;
  end_char: number;
  
  // 块内容和统计信息
  content: string;
  content_cleaned?: string;
  char_count: number;
  token_count: number;
  word_count?: number;
  
  // 页面信息(PDF特有)
  page_span?: PageSpan;
  primary_page?: number;
  
  // 重叠和关联信息
  overlap_with_prev?: OverlapInfo;
  overlap_with_next?: OverlapInfo;
  related_chunks?: string[];
  
  // 分块策略和质量信息
  chunking_strategy: ChunkingStrategy;
  chunk_type: ChunkType;
  content_quality?: number;
  has_incomplete_sentence: boolean;
  is_boundary_chunk: boolean;
  
  // 向量化状态(为Milestone 2准备)
  embedding_status: EmbeddingStatus;
  vector_id?: string;
  embedded_at?: Date;
  embedding_model?: string;
  
  // 检索优化字段
  keywords?: ExtractedKeywords;
  entities?: ExtractedEntities;
  summary?: string;
  
  // 扩展元数据
  metadata?: Record<string, any>;
  chunking_config?: ChunkingConfig;
  processing_notes?: string;
}

/**
 * 创建块请求接口
 */
export interface CreateChunkRequest {
  doc_id: string;
  section_id?: string;
  chunk_index: number;
  start_char: number;
  end_char: number;
  content: string;
  content_cleaned?: string;
  char_count: number;
  token_count: number;
  word_count?: number;
  page_span?: PageSpan;
  primary_page?: number;
  overlap_with_prev?: OverlapInfo;
  overlap_with_next?: OverlapInfo;
  related_chunks?: string[];
  chunking_strategy?: ChunkingStrategy;
  chunk_type?: ChunkType;
  content_quality?: number;
  has_incomplete_sentence?: boolean;
  is_boundary_chunk?: boolean;
  keywords?: ExtractedKeywords;
  entities?: ExtractedEntities;
  summary?: string;
  metadata?: Record<string, any>;
  chunking_config?: ChunkingConfig;
  processing_notes?: string;
}

/**
 * 更新块请求接口
 */
export interface UpdateChunkRequest {
  content?: string;
  content_cleaned?: string;
  token_count?: number;
  content_quality?: number;
  embedding_status?: EmbeddingStatus;
  vector_id?: string;
  embedded_at?: Date;
  embedding_model?: string;
  keywords?: ExtractedKeywords;
  entities?: ExtractedEntities;
  summary?: string;
  metadata?: Record<string, any>;
  processing_notes?: string;
}

/**
 * 块查询选项接口
 */
export interface ChunkQueryOptions {
  includeDeleted?: boolean;
  docId?: string;
  sectionId?: string;
  embeddingStatus?: EmbeddingStatus;
  chunkType?: ChunkType;
  chunkingStrategy?: ChunkingStrategy;
  minQuality?: number;
  minTokens?: number;
  maxTokens?: number;
  sortBy?: 'chunk_index' | 'created_at' | 'content_quality' | 'token_count';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 块统计信息接口
 */
export interface ChunkStats {
  total: number;
  byStatus: Record<EmbeddingStatus, number>;
  byType: Record<ChunkType, number>;
  avgTokens: number;
  avgQuality: number;
  totalTokens: number;
}

/**
 * 文档块模型类
 * 提供块相关的数据库操作方法
 */
export class DocumentChunkModel {
  private static readonly TABLE_NAME = 'document_chunks';

  /**
   * 创建新块
   * @param chunkData 块数据
   * @param trx 可选的数据库事务
   * @returns 创建的块信息
   */
  public static async create(
    chunkData: CreateChunkRequest,
    trx?: Knex.Transaction
  ): Promise<DocumentChunk> {
    const dbInstance = trx || db;

    try {
      // 验证块索引在文档内的唯一性
      const existingChunk = await dbInstance(this.TABLE_NAME)
        .where('doc_id', chunkData.doc_id)
        .where('chunk_index', chunkData.chunk_index)
        .first();

      if (existingChunk) {
        throw new Error(`块索引 ${chunkData.chunk_index} 在文档中已存在`);
      }

      // 生成块ID
      const chunkId = uuidv4();
      
      // 准备块记录
      const chunkRecord = {
        chunk_id: chunkId,
        doc_id: chunkData.doc_id,
        section_id: chunkData.section_id || null,
        chunk_index: chunkData.chunk_index,
        start_char: chunkData.start_char,
        end_char: chunkData.end_char,
        content: chunkData.content,
        content_cleaned: chunkData.content_cleaned || null,
        char_count: chunkData.char_count,
        token_count: chunkData.token_count,
        word_count: chunkData.word_count || null,
        page_span: chunkData.page_span ? JSON.stringify(chunkData.page_span) : null,
        primary_page: chunkData.primary_page || null,
        overlap_with_prev: chunkData.overlap_with_prev ? JSON.stringify(chunkData.overlap_with_prev) : null,
        overlap_with_next: chunkData.overlap_with_next ? JSON.stringify(chunkData.overlap_with_next) : null,
        related_chunks: chunkData.related_chunks ? JSON.stringify(chunkData.related_chunks) : null,
        chunking_strategy: chunkData.chunking_strategy || ChunkingStrategy.FIXED_SIZE,
        chunk_type: chunkData.chunk_type || ChunkType.NORMAL,
        content_quality: chunkData.content_quality || null,
        has_incomplete_sentence: chunkData.has_incomplete_sentence || false,
        is_boundary_chunk: chunkData.is_boundary_chunk || false,
        embedding_status: EmbeddingStatus.PENDING,
        vector_id: null,
        embedded_at: null,
        embedding_model: null,
        keywords: chunkData.keywords ? JSON.stringify(chunkData.keywords) : null,
        entities: chunkData.entities ? JSON.stringify(chunkData.entities) : null,
        summary: chunkData.summary || null,
        metadata: chunkData.metadata ? JSON.stringify(chunkData.metadata) : null,
        chunking_config: chunkData.chunking_config ? JSON.stringify(chunkData.chunking_config) : null,
        processing_notes: chunkData.processing_notes || null,
        created_at: new Date(),
        updated_at: new Date()
      };

      // 插入块记录
      await dbInstance(this.TABLE_NAME).insert(chunkRecord);

      // 返回创建的块信息
      const createdChunk = await this.findById(chunkId);
      if (!createdChunk) {
        throw new Error('块创建失败');
      }

      return createdChunk;
    } catch (error) {
      console.error('块创建失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找块
   * @param chunkId 块ID
   * @param options 查询选项
   * @returns 块信息
   */
  public static async findById(
    chunkId: string,
    options: ChunkQueryOptions = {}
  ): Promise<DocumentChunk | null> {
    try {
      let query = db(this.TABLE_NAME)
        .where('chunk_id', chunkId);

      query = this.applyQueryOptions(query, options);

      const chunk = await query.first();
      if (!chunk) return null;

      return this.formatChunk(chunk);
    } catch (error) {
      console.error('查找块失败:', error);
      throw error;
    }
  }

  /**
   * 根据文档ID获取所有块
   * @param docId 文档ID
   * @param options 查询选项
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 块列表
   */
  public static async findByDocument(
    docId: string,
    options: ChunkQueryOptions = {},
    limit?: number,
    offset?: number
  ): Promise<DocumentChunk[]> {
    try {
      let query = db(this.TABLE_NAME)
        .where('doc_id', docId);

      query = this.applyQueryOptions(query, options);
      
      // 默认按块索引排序
      const sortBy = options.sortBy || 'chunk_index';
      const sortOrder = options.sortOrder || 'asc';
      query = query.orderBy(sortBy, sortOrder);

      // 分页
      if (limit !== undefined) {
        query = query.limit(limit);
      }
      if (offset !== undefined) {
        query = query.offset(offset);
      }

      const chunks = await query;
      return chunks.map(chunk => this.formatChunk(chunk));
    } catch (error) {
      console.error('查找文档块失败:', error);
      throw error;
    }
  }

  /**
   * 根据章节ID获取块
   * @param sectionId 章节ID
   * @param options 查询选项
   * @returns 块列表
   */
  public static async findBySection(
    sectionId: string,
    options: ChunkQueryOptions = {}
  ): Promise<DocumentChunk[]> {
    try {
      let query = db(this.TABLE_NAME)
        .where('section_id', sectionId);

      query = this.applyQueryOptions(query, options);
      query = query.orderBy('chunk_index', 'asc');

      const chunks = await query;
      return chunks.map(chunk => this.formatChunk(chunk));
    } catch (error) {
      console.error('查找章节块失败:', error);
      throw error;
    }
  }

  /**
   * 获取待向量化的块
   * @param limit 限制数量
   * @param options 查询选项
   * @returns 待向量化的块列表
   */
  public static async findPendingEmbedding(
    limit: number = 100,
    options: ChunkQueryOptions = {}
  ): Promise<DocumentChunk[]> {
    try {
      let query = db(this.TABLE_NAME)
        .where('embedding_status', EmbeddingStatus.PENDING);

      query = this.applyQueryOptions(query, options);
      query = query.orderBy('created_at', 'asc').limit(limit);

      const chunks = await query;
      return chunks.map(chunk => this.formatChunk(chunk));
    } catch (error) {
      console.error('查找待向量化块失败:', error);
      throw error;
    }
  }

  /**
   * 更新块信息
   * @param chunkId 块ID
   * @param updates 更新数据
   * @param trx 可选的数据库事务
   * @returns 更新后的块信息
   */
  public static async update(
    chunkId: string,
    updates: UpdateChunkRequest,
    trx?: Knex.Transaction
  ): Promise<DocumentChunk | null> {
    const dbInstance = trx || db;

    try {
      // 检查块是否存在
      const existingChunk = await this.findById(chunkId);
      if (!existingChunk) {
        throw new Error('块不存在');
      }

      // 准备更新数据
      const updateData: any = {
        ...updates,
        updated_at: new Date()
      };

      // 处理JSON字段
      if (updates.keywords !== undefined) {
        updateData.keywords = updates.keywords ? JSON.stringify(updates.keywords) : null;
      }
      if (updates.entities !== undefined) {
        updateData.entities = updates.entities ? JSON.stringify(updates.entities) : null;
      }
      if (updates.metadata !== undefined) {
        updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
      }

      // 清理undefined值
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // 执行更新
      await dbInstance(this.TABLE_NAME)
        .where('chunk_id', chunkId)
        .update(updateData);

      // 返回更新后的块信息
      return await this.findById(chunkId);
    } catch (error) {
      console.error('更新块失败:', error);
      throw error;
    }
  }

  /**
   * 更新向量化状态
   * @param chunkId 块ID
   * @param status 向量化状态
   * @param vectorId 向量ID（可选）
   * @param embeddingModel 嵌入模型（可选）
   * @param trx 可选的数据库事务
   * @returns 是否更新成功
   */
  public static async updateEmbeddingStatus(
    chunkId: string,
    status: EmbeddingStatus,
    vectorId?: string,
    embeddingModel?: string,
    trx?: Knex.Transaction
  ): Promise<boolean> {
    const dbInstance = trx || db;

    try {
      const updateData: any = {
        embedding_status: status,
        updated_at: new Date()
      };

      if (status === EmbeddingStatus.COMPLETED && vectorId) {
        updateData.vector_id = vectorId;
        updateData.embedded_at = new Date();
        updateData.embedding_model = embeddingModel;
      }

      const result = await dbInstance(this.TABLE_NAME)
        .where('chunk_id', chunkId)
        .update(updateData);

      return result > 0;
    } catch (error) {
      console.error('更新向量化状态失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建块
   * @param chunksData 块数据列表
   * @param trx 可选的数据库事务
   * @returns 创建的块列表
   */
  public static async batchCreate(
    chunksData: CreateChunkRequest[],
    trx?: Knex.Transaction
  ): Promise<DocumentChunk[]> {
    const dbInstance = trx || db;

    try {
      const chunkRecords = chunksData.map(chunkData => ({
        chunk_id: uuidv4(),
        doc_id: chunkData.doc_id,
        section_id: chunkData.section_id || null,
        chunk_index: chunkData.chunk_index,
        start_char: chunkData.start_char,
        end_char: chunkData.end_char,
        content: chunkData.content,
        content_cleaned: chunkData.content_cleaned || null,
        char_count: chunkData.char_count,
        token_count: chunkData.token_count,
        word_count: chunkData.word_count || null,
        page_span: chunkData.page_span ? JSON.stringify(chunkData.page_span) : null,
        primary_page: chunkData.primary_page || null,
        overlap_with_prev: chunkData.overlap_with_prev ? JSON.stringify(chunkData.overlap_with_prev) : null,
        overlap_with_next: chunkData.overlap_with_next ? JSON.stringify(chunkData.overlap_with_next) : null,
        related_chunks: chunkData.related_chunks ? JSON.stringify(chunkData.related_chunks) : null,
        chunking_strategy: chunkData.chunking_strategy || ChunkingStrategy.FIXED_SIZE,
        chunk_type: chunkData.chunk_type || ChunkType.NORMAL,
        content_quality: chunkData.content_quality || null,
        has_incomplete_sentence: chunkData.has_incomplete_sentence || false,
        is_boundary_chunk: chunkData.is_boundary_chunk || false,
        embedding_status: EmbeddingStatus.PENDING,
        keywords: chunkData.keywords ? JSON.stringify(chunkData.keywords) : null,
        entities: chunkData.entities ? JSON.stringify(chunkData.entities) : null,
        summary: chunkData.summary || null,
        metadata: chunkData.metadata ? JSON.stringify(chunkData.metadata) : null,
        chunking_config: chunkData.chunking_config ? JSON.stringify(chunkData.chunking_config) : null,
        processing_notes: chunkData.processing_notes || null,
        created_at: new Date(),
        updated_at: new Date()
      }));

      // 批量插入
      await dbInstance(this.TABLE_NAME).insert(chunkRecords);

      // 获取创建的块
      const chunkIds = chunkRecords.map(record => record.chunk_id);
      const createdChunks = await db(this.TABLE_NAME)
        .whereIn('chunk_id', chunkIds)
        .orderBy('chunk_index', 'asc');

      return createdChunks.map(chunk => this.formatChunk(chunk));
    } catch (error) {
      console.error('批量创建块失败:', error);
      throw error;
    }
  }

  /**
   * 删除文档的所有块
   * @param docId 文档ID
   * @param trx 可选的数据库事务
   * @returns 删除的块数量
   */
  public static async deleteByDocument(docId: string, trx?: Knex.Transaction): Promise<number> {
    const dbInstance = trx || db;

    try {
      const result = await dbInstance(this.TABLE_NAME)
        .where('doc_id', docId)
        .del();

      return result;
    } catch (error) {
      console.error('删除文档块失败:', error);
      throw error;
    }
  }

  /**
   * 获取文档块统计信息
   * @param docId 文档ID
   * @returns 统计信息
   */
  public static async getDocumentChunkStats(docId: string): Promise<ChunkStats> {
    try {
      // 基础统计
      const [totalResult] = await db(this.TABLE_NAME)
        .where('doc_id', docId)
        .count('chunk_id as total')
        .avg('token_count as avgTokens')
        .avg('content_quality as avgQuality')
        .sum('token_count as totalTokens');

      // 按状态统计
      const statusStats = await db(this.TABLE_NAME)
        .where('doc_id', docId)
        .select('embedding_status')
        .count('chunk_id as count')
        .groupBy('embedding_status');

      // 按类型统计
      const typeStats = await db(this.TABLE_NAME)
        .where('doc_id', docId)
        .select('chunk_type')
        .count('chunk_id as count')
        .groupBy('chunk_type');

      // 格式化结果
      const byStatus: Record<EmbeddingStatus, number> = {} as any;
      Object.values(EmbeddingStatus).forEach(status => {
        byStatus[status] = 0;
      });
      statusStats.forEach(stat => {
        byStatus[stat.embedding_status as EmbeddingStatus] = Number(stat.count);
      });

      const byType: Record<ChunkType, number> = {} as any;
      Object.values(ChunkType).forEach(type => {
        byType[type] = 0;
      });
      typeStats.forEach(stat => {
        byType[stat.chunk_type as ChunkType] = Number(stat.count);
      });

      return {
        total: Number(totalResult?.total ?? 0),
        byStatus,
        byType,
        avgTokens: Number(totalResult?.avgTokens ?? 0),
        avgQuality: Number(totalResult?.avgQuality ?? 0),
        totalTokens: Number(totalResult?.totalTokens ?? 0)
      };
    } catch (error) {
      console.error('获取块统计失败:', error);
      throw error;
    }
  }

  /**
   * 应用查询选项
   * @param query 查询构建器
   * @param options 查询选项
   * @returns 修改后的查询构建器
   */
  private static applyQueryOptions(
    query: Knex.QueryBuilder,
    options: ChunkQueryOptions
  ): Knex.QueryBuilder {
    // 按文档ID过滤
    if (options.docId) {
      query = query.where('doc_id', options.docId);
    }

    // 按章节ID过滤
    if (options.sectionId !== undefined) {
      if (options.sectionId === null) {
        query = query.whereNull('section_id');
      } else {
        query = query.where('section_id', options.sectionId);
      }
    }

    // 按向量化状态过滤
    if (options.embeddingStatus) {
      query = query.where('embedding_status', options.embeddingStatus);
    }

    // 按块类型过滤
    if (options.chunkType) {
      query = query.where('chunk_type', options.chunkType);
    }

    // 按分块策略过滤
    if (options.chunkingStrategy) {
      query = query.where('chunking_strategy', options.chunkingStrategy);
    }

    // 按最小质量过滤
    if (options.minQuality !== undefined) {
      query = query.where('content_quality', '>=', options.minQuality);
    }

    // 按token数量过滤
    if (options.minTokens !== undefined) {
      query = query.where('token_count', '>=', options.minTokens);
    }
    if (options.maxTokens !== undefined) {
      query = query.where('token_count', '<=', options.maxTokens);
    }

    return query;
  }

  /**
   * 格式化块对象
   * @param chunk 原始块数据
   * @returns 格式化后的块对象
   */
  private static formatChunk(chunk: any): DocumentChunk {
    return {
      ...chunk,
      // 解析JSON字段
      page_span: chunk.page_span ? JSON.parse(chunk.page_span) : undefined,
      overlap_with_prev: chunk.overlap_with_prev ? JSON.parse(chunk.overlap_with_prev) : undefined,
      overlap_with_next: chunk.overlap_with_next ? JSON.parse(chunk.overlap_with_next) : undefined,
      related_chunks: chunk.related_chunks ? JSON.parse(chunk.related_chunks) : undefined,
      keywords: chunk.keywords ? JSON.parse(chunk.keywords) : undefined,
      entities: chunk.entities ? JSON.parse(chunk.entities) : undefined,
      metadata: chunk.metadata ? JSON.parse(chunk.metadata) : undefined,
      chunking_config: chunk.chunking_config ? JSON.parse(chunk.chunking_config) : undefined,
      // 确保数字类型
      chunk_index: Number(chunk.chunk_index),
      start_char: Number(chunk.start_char),
      end_char: Number(chunk.end_char),
      char_count: Number(chunk.char_count),
      token_count: Number(chunk.token_count),
      word_count: chunk.word_count ? Number(chunk.word_count) : undefined,
      primary_page: chunk.primary_page ? Number(chunk.primary_page) : undefined,
      content_quality: chunk.content_quality ? Number(chunk.content_quality) : undefined,
      // 确保布尔类型
      has_incomplete_sentence: Boolean(chunk.has_incomplete_sentence),
      is_boundary_chunk: Boolean(chunk.is_boundary_chunk)
    };
  }
}

// 导出块模型类
export default DocumentChunkModel;