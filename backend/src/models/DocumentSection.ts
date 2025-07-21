// src/models/DocumentSection.ts

import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/utils/database';
import { BaseEntity } from '@/types/base';

/**
 * 章节提取状态枚举
 */
export enum SectionExtractionStatus {
  PENDING = 'pending',     // 待提取
  EXTRACTED = 'extracted', // 已提取
  CLEANED = 'cleaned',     // 已清洗
  FAILED = 'failed'        // 提取失败
}

/**
 * 章节类型枚举
 */
export enum SectionType {
  SECTION = 'section',     // 普通章节
  TOC = 'toc',            // 目录
  HEADER = 'header',       // 页眉
  FOOTER = 'footer'        // 页脚
}

/**
 * PDF坐标信息接口
 */
export interface PDFCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

/**
 * Markdown属性接口
 */
export interface MarkdownAttributes {
  id?: string;
  className?: string;
  anchor?: string;
  [key: string]: any;
}

/**
 * 质量指标接口
 */
export interface QualityMetrics {
  textLength: number;
  sentenceCount: number;
  wordCount: number;
  readabilityScore?: number;
  hasFormulas?: boolean;
  hasCode?: boolean;
  hasTables?: boolean;
}

/**
 * 文档章节基础接口
 */
export interface DocumentSection extends BaseEntity {
  section_id: string;
  doc_id: string;
  parent_section_id?: string;
  
  // 层级和结构信息
  level: number;
  title?: string;
  section_order: number;
  section_type: SectionType;
  
  // 内容
  content: string;
  content_cleaned?: string;
  token_count?: number;
  
  // 位置信息
  start_page?: number;
  end_page?: number;
  start_char: number;
  end_char: number;
  
  // Markdown特有字段
  markdown_heading?: string;
  markdown_attributes?: MarkdownAttributes;
  
  // PDF特有字段
  pdf_coordinates?: PDFCoordinates;
  font_info?: string;
  
  // 处理状态和质量评估
  extraction_status: SectionExtractionStatus;
  confidence_score?: number;
  quality_metrics?: QualityMetrics;
  
  // 扩展元数据
  metadata?: Record<string, any>;
  extraction_notes?: string;
}

/**
 * 创建章节请求接口
 */
export interface CreateSectionRequest {
  doc_id: string;
  parent_section_id?: string;
  level: number;
  title?: string;
  section_order: number;
  section_type?: SectionType;
  content: string;
  content_cleaned?: string;
  token_count?: number;
  start_page?: number;
  end_page?: number;
  start_char: number;
  end_char: number;
  markdown_heading?: string;
  markdown_attributes?: MarkdownAttributes;
  pdf_coordinates?: PDFCoordinates;
  font_info?: string;
  confidence_score?: number;
  quality_metrics?: QualityMetrics;
  metadata?: Record<string, any>;
  extraction_notes?: string;
}

/**
 * 更新章节请求接口
 */
export interface UpdateSectionRequest {
  title?: string;
  content?: string;
  content_cleaned?: string;
  token_count?: number;
  extraction_status?: SectionExtractionStatus;
  confidence_score?: number;
  quality_metrics?: QualityMetrics;
  metadata?: Record<string, any>;
  extraction_notes?: string;
}

/**
 * 章节查询选项接口
 */
export interface SectionQueryOptions {
  includeDeleted?: boolean;
  docId?: string;
  level?: number;
  parentSectionId?: string;
  extractionStatus?: SectionExtractionStatus;
  sectionType?: SectionType;
  minConfidence?: number;
  sortBy?: 'section_order' | 'level' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 章节树节点接口
 */
export interface SectionTreeNode extends DocumentSection {
  children: SectionTreeNode[];
  depth: number;
}

/**
 * 文档章节模型类
 * 提供章节相关的数据库操作方法
 */
export class DocumentSectionModel {
  private static readonly TABLE_NAME = 'document_sections';

  /**
   * 创建新章节
   * @param sectionData 章节数据
   * @param trx 可选的数据库事务
   * @returns 创建的章节信息
   */
  public static async create(
    sectionData: CreateSectionRequest,
    trx?: Knex.Transaction
  ): Promise<DocumentSection> {
    const dbInstance = trx || db;

    try {
      // 验证父章节是否存在
      if (sectionData.parent_section_id) {
        const parentSection = await this.findById(sectionData.parent_section_id);
        if (!parentSection) {
          throw new Error('父章节不存在');
        }
        if (parentSection.doc_id !== sectionData.doc_id) {
          throw new Error('父章节必须属于同一文档');
        }
      }

      // 生成章节ID
      const sectionId = uuidv4();
      
      // 准备章节记录
      const sectionRecord = {
        section_id: sectionId,
        doc_id: sectionData.doc_id,
        parent_section_id: sectionData.parent_section_id || null,
        level: sectionData.level,
        title: sectionData.title?.trim() || null,
        section_order: sectionData.section_order,
        section_type: sectionData.section_type || SectionType.SECTION,
        content: sectionData.content,
        content_cleaned: sectionData.content_cleaned || null,
        token_count: sectionData.token_count || null,
        start_page: sectionData.start_page || null,
        end_page: sectionData.end_page || null,
        start_char: sectionData.start_char,
        end_char: sectionData.end_char,
        markdown_heading: sectionData.markdown_heading || null,
        markdown_attributes: sectionData.markdown_attributes ? JSON.stringify(sectionData.markdown_attributes) : null,
        pdf_coordinates: sectionData.pdf_coordinates ? JSON.stringify(sectionData.pdf_coordinates) : null,
        font_info: sectionData.font_info || null,
        extraction_status: SectionExtractionStatus.EXTRACTED,
        confidence_score: sectionData.confidence_score || null,
        quality_metrics: sectionData.quality_metrics ? JSON.stringify(sectionData.quality_metrics) : null,
        metadata: sectionData.metadata ? JSON.stringify(sectionData.metadata) : null,
        extraction_notes: sectionData.extraction_notes || null,
        created_at: new Date(),
        updated_at: new Date()
      };

      // 插入章节记录
      await dbInstance(this.TABLE_NAME).insert(sectionRecord);

      // 返回创建的章节信息
      const createdSection = await this.findById(sectionId);
      if (!createdSection) {
        throw new Error('章节创建失败');
      }

      return createdSection;
    } catch (error) {
      console.error('章节创建失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找章节
   * @param sectionId 章节ID
   * @param options 查询选项
   * @returns 章节信息
   */
  public static async findById(
    sectionId: string,
    options: SectionQueryOptions = {}
  ): Promise<DocumentSection | null> {
    try {
      let query = db(this.TABLE_NAME)
        .where('section_id', sectionId);

      query = this.applyQueryOptions(query, options);

      const section = await query.first();
      if (!section) return null;

      return this.formatSection(section);
    } catch (error) {
      console.error('查找章节失败:', error);
      throw error;
    }
  }

  /**
   * 根据文档ID获取所有章节
   * @param docId 文档ID
   * @param options 查询选项
   * @returns 章节列表
   */
  public static async findByDocument(
    docId: string,
    options: SectionQueryOptions = {}
  ): Promise<DocumentSection[]> {
    try {
      let query = db(this.TABLE_NAME)
        .where('doc_id', docId);

      query = this.applyQueryOptions(query, options);
      
      // 默认按层级和顺序排序
      const sortBy = options.sortBy || 'section_order';
      const sortOrder = options.sortOrder || 'asc';
      query = query.orderBy('level', 'asc').orderBy(sortBy, sortOrder);

      const sections = await query;
      return sections.map(section => this.formatSection(section));
    } catch (error) {
      console.error('查找文档章节失败:', error);
      throw error;
    }
  }

  /**
   * 获取章节树结构
   * @param docId 文档ID
   * @param options 查询选项
   * @returns 章节树
   */
  public static async getDocumentTree(
    docId: string,
    options: SectionQueryOptions = {}
  ): Promise<SectionTreeNode[]> {
    try {
      const sections = await this.findByDocument(docId, options);
      return this.buildSectionTree(sections);
    } catch (error) {
      console.error('构建章节树失败:', error);
      throw error;
    }
  }

  /**
   * 获取子章节
   * @param parentSectionId 父章节ID
   * @param options 查询选项
   * @returns 子章节列表
   */
  public static async findChildren(
    parentSectionId: string,
    options: SectionQueryOptions = {}
  ): Promise<DocumentSection[]> {
    try {
      let query = db(this.TABLE_NAME)
        .where('parent_section_id', parentSectionId);

      query = this.applyQueryOptions(query, options);
      query = query.orderBy('section_order', 'asc');

      const sections = await query;
      return sections.map(section => this.formatSection(section));
    } catch (error) {
      console.error('查找子章节失败:', error);
      throw error;
    }
  }

  /**
   * 更新章节信息
   * @param sectionId 章节ID
   * @param updates 更新数据
   * @param trx 可选的数据库事务
   * @returns 更新后的章节信息
   */
  public static async update(
    sectionId: string,
    updates: UpdateSectionRequest,
    trx?: Knex.Transaction
  ): Promise<DocumentSection | null> {
    const dbInstance = trx || db;

    try {
      // 检查章节是否存在
      const existingSection = await this.findById(sectionId);
      if (!existingSection) {
        throw new Error('章节不存在');
      }

      // 准备更新数据
      const updateData: any = {
        ...updates,
        updated_at: new Date()
      };

      // 处理JSON字段
      if (updates.quality_metrics !== undefined) {
        updateData.quality_metrics = updates.quality_metrics ? JSON.stringify(updates.quality_metrics) : null;
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
        .where('section_id', sectionId)
        .update(updateData);

      // 返回更新后的章节信息
      return await this.findById(sectionId);
    } catch (error) {
      console.error('更新章节失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建章节
   * @param sectionsData 章节数据列表
   * @param trx 可选的数据库事务
   * @returns 创建的章节列表
   */
  public static async batchCreate(
    sectionsData: CreateSectionRequest[],
    trx?: Knex.Transaction
  ): Promise<DocumentSection[]> {
    const dbInstance = trx || db;

    try {
      const sectionRecords = sectionsData.map(sectionData => ({
        section_id: uuidv4(),
        doc_id: sectionData.doc_id,
        parent_section_id: sectionData.parent_section_id || null,
        level: sectionData.level,
        title: sectionData.title?.trim() || null,
        section_order: sectionData.section_order,
        section_type: sectionData.section_type || SectionType.SECTION,
        content: sectionData.content,
        content_cleaned: sectionData.content_cleaned || null,
        token_count: sectionData.token_count || null,
        start_page: sectionData.start_page || null,
        end_page: sectionData.end_page || null,
        start_char: sectionData.start_char,
        end_char: sectionData.end_char,
        markdown_heading: sectionData.markdown_heading || null,
        markdown_attributes: sectionData.markdown_attributes ? JSON.stringify(sectionData.markdown_attributes) : null,
        pdf_coordinates: sectionData.pdf_coordinates ? JSON.stringify(sectionData.pdf_coordinates) : null,
        font_info: sectionData.font_info || null,
        extraction_status: SectionExtractionStatus.EXTRACTED,
        confidence_score: sectionData.confidence_score || null,
        quality_metrics: sectionData.quality_metrics ? JSON.stringify(sectionData.quality_metrics) : null,
        metadata: sectionData.metadata ? JSON.stringify(sectionData.metadata) : null,
        extraction_notes: sectionData.extraction_notes || null,
        created_at: new Date(),
        updated_at: new Date()
      }));

      // 批量插入
      await dbInstance(this.TABLE_NAME).insert(sectionRecords);

      // 获取创建的章节
      const sectionIds = sectionRecords.map(record => record.section_id);
      const createdSections = await db(this.TABLE_NAME)
        .whereIn('section_id', sectionIds)
        .orderBy('section_order', 'asc');

      return createdSections.map(section => this.formatSection(section));
    } catch (error) {
      console.error('批量创建章节失败:', error);
      throw error;
    }
  }

  /**
   * 删除文档的所有章节
   * @param docId 文档ID
   * @param trx 可选的数据库事务
   * @returns 删除的章节数量
   */
  public static async deleteByDocument(docId: string, trx?: Knex.Transaction): Promise<number> {
    const dbInstance = trx || db;

    try {
      const result = await dbInstance(this.TABLE_NAME)
        .where('doc_id', docId)
        .del();

      return result;
    } catch (error) {
      console.error('删除文档章节失败:', error);
      throw error;
    }
  }

  /**
   * 获取文档章节统计信息
   * @param docId 文档ID
   * @returns 统计信息
   */
  public static async getDocumentSectionStats(docId: string): Promise<{
    total: number;
    byLevel: Record<number, number>;
    byStatus: Record<SectionExtractionStatus, number>;
    avgConfidence: number;
    totalTokens: number;
  }> {
    try {
      // 基础统计
      const [totalResult] = await db(this.TABLE_NAME)
        .where('doc_id', docId)
        .count('section_id as total')
        .avg('confidence_score as avgConfidence')
        .sum('token_count as totalTokens');

      // 按层级统计
      const levelStats = await db(this.TABLE_NAME)
        .where('doc_id', docId)
        .select('level')
        .count('section_id as count')
        .groupBy('level');

      // 按状态统计
      const statusStats = await db(this.TABLE_NAME)
        .where('doc_id', docId)
        .select('extraction_status')
        .count('section_id as count')
        .groupBy('extraction_status');

      // 格式化结果
      const byLevel: Record<number, number> = {};
      levelStats.forEach(stat => {
        if (stat.level !== undefined) {
          byLevel[Number(stat.level)] = Number(stat.count);
        }
      });

      const byStatus: Record<SectionExtractionStatus, number> = {} as any;
      Object.values(SectionExtractionStatus).forEach(status => {
        byStatus[status] = 0;
      });
      statusStats.forEach(stat => {
        byStatus[stat.extraction_status as SectionExtractionStatus] = Number(stat.count);
      });

      return {
        total: Number(totalResult?.total) || 0,
        byLevel,
        byStatus,
        avgConfidence: Number(totalResult?.avgConfidence) || 0,
        totalTokens: Number(totalResult?.totalTokens) || 0
      };
    } catch (error) {
      console.error('获取章节统计失败:', error);
      throw error;
    }
  }

  /**
   * 构建章节树结构
   * @param sections 章节列表
   * @returns 章节树
   */
  private static buildSectionTree(sections: DocumentSection[]): SectionTreeNode[] {
    const sectionMap = new Map<string, SectionTreeNode>();
    const rootSections: SectionTreeNode[] = [];

    // 创建节点映射
    sections.forEach(section => {
      const node: SectionTreeNode = {
        ...section,
        children: [],
        depth: 0
      };
      sectionMap.set(section.section_id, node);
    });

    // 构建树结构
    sections.forEach(section => {
      const node = sectionMap.get(section.section_id)!;
      
      if (section.parent_section_id) {
        const parent = sectionMap.get(section.parent_section_id);
        if (parent) {
          parent.children.push(node);
          node.depth = parent.depth + 1;
        } else {
          rootSections.push(node);
        }
      } else {
        rootSections.push(node);
      }
    });

    return rootSections;
  }

  /**
   * 应用查询选项
   * @param query 查询构建器
   * @param options 查询选项
   * @returns 修改后的查询构建器
   */
  private static applyQueryOptions(
    query: Knex.QueryBuilder,
    options: SectionQueryOptions
  ): Knex.QueryBuilder {
    // 按文档ID过滤
    if (options.docId) {
      query = query.where('doc_id', options.docId);
    }

    // 按层级过滤
    if (options.level !== undefined) {
      query = query.where('level', options.level);
    }

    // 按父章节过滤
    if (options.parentSectionId !== undefined) {
      if (options.parentSectionId === null) {
        query = query.whereNull('parent_section_id');
      } else {
        query = query.where('parent_section_id', options.parentSectionId);
      }
    }

    // 按提取状态过滤
    if (options.extractionStatus) {
      query = query.where('extraction_status', options.extractionStatus);
    }

    // 按章节类型过滤
    if (options.sectionType) {
      query = query.where('section_type', options.sectionType);
    }

    // 按最小置信度过滤
    if (options.minConfidence !== undefined) {
      query = query.where('confidence_score', '>=', options.minConfidence);
    }

    return query;
  }

  /**
   * 格式化章节对象
   * @param section 原始章节数据
   * @returns 格式化后的章节对象
   */
  private static formatSection(section: any): DocumentSection {
    return {
      ...section,
      // 解析JSON字段
      markdown_attributes: section.markdown_attributes ? JSON.parse(section.markdown_attributes) : undefined,
      pdf_coordinates: section.pdf_coordinates ? JSON.parse(section.pdf_coordinates) : undefined,
      quality_metrics: section.quality_metrics ? JSON.parse(section.quality_metrics) : undefined,
      metadata: section.metadata ? JSON.parse(section.metadata) : undefined,
      // 确保数字类型
      level: Number(section.level),
      section_order: Number(section.section_order),
      start_char: Number(section.start_char),
      end_char: Number(section.end_char),
      start_page: section.start_page ? Number(section.start_page) : undefined,
      end_page: section.end_page ? Number(section.end_page) : undefined,
      token_count: section.token_count ? Number(section.token_count) : undefined,
      confidence_score: section.confidence_score ? Number(section.confidence_score) : undefined
    };
  }
}

// 导出章节模型类
export default DocumentSectionModel;