// src/services/ChunkService.ts - 文档分块服务

import { Knex } from 'knex';
import crypto from 'crypto';
import { Database } from '@/utils/database';
import DocumentModel, { Document, DocumentIngestStatus } from '@/models/Document';
import DocumentSectionModel, { DocumentSection } from '@/models/DocumentSection';
import DocumentChunkModel, {
  DocumentChunk,
  CreateChunkRequest,
  ChunkingStrategy,
  ChunkType,
  ChunkingConfig,
  OverlapInfo
} from '@/models/DocumentChunk';
import { TextNormalizer, NormalizationResult } from '@/services/TextNormalizer';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 分块请求接口
 */
export interface ChunkRequest {
  /** 文档ID */
  docId: string;
  /** 用户ID */
  userId: string;
  /** 分块配置 */
  config: ChunkingConfig;
  /** 进度回调 */
  onProgress?: (progress: ChunkProgress) => Promise<void>;
}

/**
 * 分块进度接口
 */
export interface ChunkProgress {
  /** 当前进度 */
  current: number;
  /** 总进度 */
  total: number;
  /** 进度消息 */
  message: string;
  /** 详细信息 */
  details?: {
    processedSections: number;
    totalSections: number;
    createdChunks: number;
  };
}

/**
 * 分块结果接口
 */
export interface ChunkResult {
  /** 文档ID */
  docId: string;
  /** 创建的块数量 */
  chunksCreated: number;
  /** 处理的章节数 */
  sectionsProcessed: number;
  /** 总字符数 */
  totalChars: number;
  /** 总Token数 */
  totalTokens: number;
  /** 统计信息 */
  stats: {
    avgChunkSize: number;
    avgTokensPerChunk: number;
    minChunkSize: number;
    maxChunkSize: number;
    overlapRatio: number;
  };
}

/**
 * 章节块信息
 */
interface SectionChunk {
  content: string;
  startChar: number;
  endChar: number;
  tokens: number;
  type: ChunkType;
  hasIncomplete: boolean;
}

/**
 * 文档分块服务
 * 
 * 职责：
 * - 将文档章节分割成合适大小的块
 * - 实现智能分块策略
 * - 处理块之间的重叠
 * - 计算块的质量评分
 * - 保存分块结果到数据库
 */
export class ChunkService {
  private static readonly VERSION = '1.0.0';
  
  /**
   * 默认分块配置
   */
  private static readonly DEFAULT_CONFIG: ChunkingConfig = {
    strategy: ChunkingStrategy.HYBRID,
    targetTokens: 400,
    maxTokens: 500,
    overlapTokens: 60,
    respectBoundaries: true,
    minChunkSize: 50
  };

  /**
   * 处理文档分块
   * @param request 分块请求
   * @returns 分块结果
   */
public static async chunkDocument(request: ChunkRequest): Promise<ChunkResult> {
  const { docId, userId, config, onProgress } = request;
  const mergedConfig = { ...this.DEFAULT_CONFIG, ...config };

  console.log(`🔪 开始文档分块: ${docId} (策略: ${mergedConfig.strategy})`);

  try {
    // 1. 幂等性检查
    await this.updateProgress(onProgress, 5, 100, '检查分块状态...');
    const shouldSkip = await this.checkIdempotency(docId);
    if (shouldSkip) {
      console.log(`♻️ 文档已分块，跳过处理: ${docId}`);
      return await this.getExistingChunkResult(docId);
    }

    // 2. 验证文档状态
    await this.updateProgress(onProgress, 10, 100, '验证文档状态...');
    const document = await this.validateDocument(docId, userId);

    // 3. 获取文档章节
    await this.updateProgress(onProgress, 15, 100, '读取文档章节...');
    const sections = await DocumentSectionModel.findByDocument(docId);
    if (sections.length === 0) {
      throw new Error('文档没有章节数据，无法分块');
    }

    console.log(`📖 找到 ${sections.length} 个章节待分块`);

    // 4. 更新文档状态为分块中
    await DocumentModel.updateStatus(docId, DocumentIngestStatus.CHUNKING);

    // 5. 处理每个章节的分块（关键：维护全局 chunk 索引）
    const allChunks: CreateChunkRequest[] = [];
    let processedSections = 0;
    let globalIndex = 0; // <--- 全局 chunk 索引从 0 开始

    for (const section of sections) {
      const sectionProgress = 20 + (processedSections / sections.length) * 60;
      await this.updateProgress(
        onProgress,
        sectionProgress,
        100,
        `处理章节 ${processedSections + 1}/${sections.length}...`,
        {
          processedSections,
          totalSections: sections.length,
          createdChunks: allChunks.length
        }
      );

      // 标准化章节文本（如你暂未改动，这里保持不变）
      const textForChunking = section.content_cleaned ?? section.content ?? '';

      // 创建章节的块 —— 传入 baseIndex（全局起点）
      const sectionChunks = await this.createSectionChunks(
        section,
        textForChunking,
        mergedConfig,
        globalIndex              // <--- 新增：把当前全局索引传进去
      );

      allChunks.push(...sectionChunks);
      processedSections++;
      globalIndex += sectionChunks.length;  // <--- 累加，下一章节从此处继续编号
    }

    // 6. 批量保存块到数据库
    await this.updateProgress(onProgress, 85, 100, '保存分块数据...');
    await this.saveChunks(docId, allChunks);

    // 7. 更新文档状态
    await this.updateProgress(onProgress, 95, 100, '更新文档状态...');
    await this.updateDocumentStatus(docId, allChunks);

    // 8. 生成统计信息
    const result = this.generateChunkResult(docId, allChunks, sections.length);

    await this.updateProgress(onProgress, 100, 100, '分块完成');
    console.log(`✅ 文档分块完成: ${docId} (${allChunks.length} 个块)`);

    return result;

  } catch (error) {
    console.error(`❌ 文档分块失败: ${docId}`, error);
    await DocumentModel.updateStatus(
      docId,
      DocumentIngestStatus.FAILED,
      getErrorMessage(error)
    );
    throw error;
  }
}

  /**
   * 检查幂等性
   */
  private static async checkIdempotency(docId: string): Promise<boolean> {
    try {
      const existingChunks = await DocumentChunkModel.findByDocument(docId, {}, 1);
      return existingChunks.length > 0;
    } catch (error) {
      console.warn('幂等性检查失败，继续处理:', error);
      return false;
    }
  }

  /**
   * 验证文档状态
   */
  private static async validateDocument(docId: string, userId: string): Promise<Document> {
    const document = await DocumentModel.findById(docId);
    
    if (!document) {
      throw new Error(`文档不存在: ${docId}`);
    }

    // 开发环境跳过用户验证
    if (process.env.NODE_ENV !== 'development' && document.user_id !== userId) {
      throw new Error('无权限处理该文档');
    }

    // 检查文档状态
    const validStatuses = [
      DocumentIngestStatus.PARSED,
      DocumentIngestStatus.CHUNKED // 允许重新分块
    ];

    if (!validStatuses.includes(document.ingest_status)) {
      throw new Error(`文档状态不正确: ${document.ingest_status}`);
    }

    return document;
  }

  /**
   * 标准化章节文本
   */
  private static async normalizeSection(section: DocumentSection): Promise<string> {
    // 优先使用已清理的内容
    const content = section.content_cleaned || section.content;
    
    // 应用文本标准化
    const result = TextNormalizer.normalize(content, {
      removeExtraWhitespace: true,
      normalizeQuotes: true,
      removeControlChars: true,
      normalizeLineBreaks: true,
      preserveParagraphs: true,
      minParagraphLength: 20
    });

    return result.cleanedText;
  }

  /**
   * 创建章节的块
   */
    private static async createSectionChunks(
    section: DocumentSection,
    normalizedText: string,
    config: ChunkingConfig,
    baseIndex: number                 // <--- 新增参数：该章节首个 chunk 的全局起点
    ): Promise<CreateChunkRequest[]> {
    const chunks: CreateChunkRequest[] = [];

    // 根据策略选择分块方法，得到“章节内的原始块数组”
    let rawChunks: SectionChunk[];
    switch (config.strategy) {
        case ChunkingStrategy.SEMANTIC:
        rawChunks = this.semanticChunking(normalizedText, config);
        break;
        case ChunkingStrategy.HYBRID:
        rawChunks = this.hybridChunking(normalizedText, config);
        break;
        case ChunkingStrategy.FIXED_SIZE:
        default:
        rawChunks = this.fixedSizeChunking(normalizedText, config);
        break;
    }

    // 章节内第 i 个块 => 全局 chunk_index = baseIndex + i
    for (let i = 0; i < rawChunks.length; i++) {
        const chunk = rawChunks[i];
        if (!chunk) continue;

        const overlapWithPrev = i > 0 ? this.calculateOverlap(rawChunks[i - 1], chunk) : undefined;
        const overlapWithNext = i < rawChunks.length - 1 ? this.calculateOverlap(chunk, rawChunks[i + 1]) : undefined;

        const contentHash = this.generateContentHash(chunk.content);
        const qualityScore = this.calculateQualityScore(chunk);

        const chunkRequest: CreateChunkRequest = {
        doc_id: section.doc_id,
        section_id: section.section_id,
        chunk_index: baseIndex + i,           // <--- 关键：全局递增
        start_char: section.start_char + chunk.startChar,
        end_char: section.start_char + chunk.endChar,
        content: chunk.content,
        content_cleaned: chunk.content,                 // 此时已是 normalizedText 的子串
        char_count: chunk.content.length,
        token_count: chunk.tokens,
        word_count: this.countWords(chunk.content),
        page_span: this.calculatePageSpan(section, chunk),
        primary_page: section.start_page,
        overlap_with_prev: overlapWithPrev,
        overlap_with_next: overlapWithNext,
        chunking_strategy: config.strategy,
        chunk_type: chunk.type,
        content_quality: qualityScore,
        has_incomplete_sentence: chunk.hasIncomplete,
        is_boundary_chunk: i === 0 || i === rawChunks.length - 1,
        metadata: {
            sectionTitle: section.title,
            sectionOrder: section.section_order,
            contentHash,
            version: this.VERSION
        },
        chunking_config: config,
        };

        chunks.push(chunkRequest);
    }

    return chunks;
    }

  /**
   * 固定大小分块
   */
  private static fixedSizeChunking(
    text: string,
    config: ChunkingConfig
  ): SectionChunk[] {
    const chunks: SectionChunk[] = [];
    const { targetTokens, maxTokens, overlapTokens } = config;

    let currentPos = 0;
    const textLength = text.length;

    while (currentPos < textLength) {
      // 估算块的字符长度（假设平均4字符=1token）
      const estimatedChars = targetTokens * 4;
      let endPos = Math.min(currentPos + estimatedChars, textLength);

      // 尊重边界（句子、段落）
      if (config.respectBoundaries && endPos < textLength) {
        endPos = this.findBoundary(text, endPos, maxTokens * 4);
      }

      // 提取块内容
      const content = text.substring(currentPos, endPos);
      const tokens = TextNormalizer.countTokens(content);

      // 检查是否有不完整的句子
      const hasIncomplete = this.hasIncompleteSentence(content);

      chunks.push({
        content,
        startChar: currentPos,
        endChar: endPos,
        tokens,
        type: ChunkType.NORMAL,
        hasIncomplete
      });

      // 到尾就直接退出
    if (endPos >= textLength) break;


      // 计算下一个块的起始位置（考虑重叠）
    const overlapChars = Math.max(0, Math.floor((config.overlapTokens ?? 0) * 4));
    const nextPos = Math.max(0, endPos - overlapChars);

    currentPos = nextPos > currentPos ? nextPos : endPos;
      
      // 防止无限循环
      if (currentPos >= endPos) {
        currentPos = endPos;
      }
    }

    return chunks;
  }

  /**
   * 语义分块
   */
  private static semanticChunking(
    text: string,
    config: ChunkingConfig
  ): SectionChunk[] {
    // 按段落分割
    const paragraphs = text.split(/\n\n+/);
    const chunks: SectionChunk[] = [];
    
    let currentChunk = '';
    let currentStartChar = 0;
    let currentTokens = 0;
    let charOffset = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = TextNormalizer.countTokens(paragraph);
      
      // 如果当前块+段落超过目标大小，保存当前块
      if (currentTokens + paragraphTokens > config.targetTokens && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          startChar: currentStartChar,
          endChar: charOffset,
          tokens: currentTokens,
          type: ChunkType.PARAGRAPH,
          hasIncomplete: false
        });

        // 开始新块（带重叠）
        const overlapText = this.getOverlapText(currentChunk, config.overlapTokens);
        currentChunk = overlapText + '\n\n' + paragraph;
        currentStartChar = charOffset - overlapText.length;
        currentTokens = TextNormalizer.countTokens(currentChunk);
      } else {
        // 添加到当前块
        if (currentChunk) {
          currentChunk += '\n\n' + paragraph;
        } else {
          currentChunk = paragraph;
          currentStartChar = charOffset;
        }
        currentTokens += paragraphTokens;
      }

      charOffset += paragraph.length + 2; // +2 for \n\n
    }

    // 保存最后一个块
    if (currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        startChar: currentStartChar,
        endChar: text.length,
        tokens: currentTokens,
        type: ChunkType.PARAGRAPH,
        hasIncomplete: false
      });
    }

    return chunks;
  }

  /**
   * 混合分块策略
   */
  private static hybridChunking(
    text: string,
    config: ChunkingConfig
  ): SectionChunk[] {
    // 先尝试语义分块
    const semanticChunks = this.semanticChunking(text, config);
    
    // 对过大的块进行二次分割
    const finalChunks: SectionChunk[] = [];
    
    for (const chunk of semanticChunks) {
      if (chunk.tokens > config.maxTokens) {
        // 块太大，使用固定大小分割
        const subChunks = this.fixedSizeChunking(chunk.content, {
          ...config,
          targetTokens: Math.floor(config.targetTokens * 0.8)
        });
        
        // 调整字符位置
        for (const subChunk of subChunks) {
          finalChunks.push({
            ...subChunk,
            startChar: chunk.startChar + subChunk.startChar,
            endChar: chunk.startChar + subChunk.endChar
          });
        }
      } else {
        finalChunks.push(chunk);
      }
    }

    return finalChunks;
  }

  /**
   * 查找合适的边界
   */
  private static findBoundary(text: string, pos: number, maxPos: number): number {
    // 优先级：段落 > 句子 > 单词
    
    // 1. 查找段落边界
    const paragraphEnd = text.indexOf('\n\n', pos);
    if (paragraphEnd !== -1 && paragraphEnd <= maxPos) {
      return paragraphEnd;
    }

    // 2. 查找句子边界
    const sentenceEnds = ['.', '。', '!', '！', '?', '？'];
    for (let i = pos; i <= Math.min(pos + 100, maxPos, text.length - 1); i++) {
      if (sentenceEnds.includes(text[i] ?? '') && i + 1 < text.length) {
        // 确保不是缩写（如 Mr. Dr.）
        if (text[i + 1] === ' ' || text[i + 1] === '\n') {
          return i + 1;
        }
      }
    }

    // 3. 查找单词边界
    for (let i = pos; i >= Math.max(pos - 50, 0); i--) {
      if (text[i] === ' ' || text[i] === '\n') {
        return i;
      }
    }

    return pos;
  }

  /**
   * 检查是否有不完整的句子
   */
  private static hasIncompleteSentence(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) return false;

    // 检查结尾是否是完整句子
    const lastChar = trimmed[trimmed.length - 1];
    const sentenceEnds = ['.', '。', '!', '！', '?', '？', '"', '"', '』'];
    
    return !sentenceEnds.includes(lastChar ?? '');
  }

  /**
   * 获取重叠文本
   */
  private static getOverlapText(text: string, overlapTokens: number): string {
    const words = text.split(/\s+/);
    const estimatedWords = Math.floor(overlapTokens * 0.75); // 估算单词数
    
    if (words.length <= estimatedWords) {
      return text;
    }

    return words.slice(-estimatedWords).join(' ');
  }

  /**
   * 计算重叠信息
   */
  private static calculateOverlap(
    chunk1: SectionChunk | undefined,
    chunk2: SectionChunk | undefined
  ): OverlapInfo | undefined {
    if (!chunk1 || !chunk2) return undefined;

    const overlap = chunk1.endChar - chunk2.startChar;
    if (overlap <= 0) return undefined;

    const overlapText = chunk1.content.substring(
      chunk1.content.length - overlap
    );

    return {
      chunk_id: '', // 将在保存时填充
      overlap_chars: overlap,
      overlap_tokens: TextNormalizer.countTokens(overlapText)
    };
  }

  /**
   * 计算页面跨度
   */
  private static calculatePageSpan(
    section: DocumentSection,
    chunk: SectionChunk
  ): any {
    if (!section.start_page || !section.end_page) {
      return undefined;
    }

    // 简单估算：基于字符位置
    const sectionLength = section.end_char - section.start_char;
    const chunkRelativeStart = chunk.startChar / sectionLength;
    const chunkRelativeEnd = chunk.endChar / sectionLength;

    const pageRange = section.end_page - section.start_page;
    
    return {
      start: section.start_page + Math.floor(pageRange * chunkRelativeStart),
      end: section.start_page + Math.ceil(pageRange * chunkRelativeEnd),
      primary: section.start_page
    };
  }

  /**
   * 计算质量评分
   */
  private static calculateQualityScore(chunk: SectionChunk): number {
    let score = 0.5; // 基础分

    // 长度合适 +0.2
    if (chunk.tokens >= 300 && chunk.tokens <= 500) {
      score += 0.2;
    }

    // 完整句子 +0.2
    if (!chunk.hasIncomplete) {
      score += 0.2;
    }

    // 内容丰富度 +0.1
    const uniqueWords = new Set(chunk.content.split(/\s+/));
    if (uniqueWords.size > 50) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 生成内容哈希
   */
  private static generateContentHash(content: string): string {
    return crypto.createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * 统计单词数
   */
  private static countWords(text: string): number {
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    
    if (hasChinese) {
      // 中文按字符计数
      const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
      const englishWords = text.match(/[a-zA-Z]+/g) || [];
      return chineseChars.length + englishWords.length;
    }
    
    // 英文按单词计数
    const words = text.match(/\b\w+\b/g) || [];
    return words.length;
  }

  /**
   * 保存块到数据库
   */
  private static async saveChunks(
    docId: string,
    chunks: CreateChunkRequest[]
  ): Promise<void> {
    await Database.withTransaction(async (trx: Knex.Transaction) => {
      try {
        // 删除现有块（幂等性）
        await trx('document_chunks')
          .where('doc_id', docId)
          .del();

        // 批量创建新块
        if (chunks.length > 0) {
          await DocumentChunkModel.batchCreate(chunks, trx);
        }

        console.log(`💾 保存 ${chunks.length} 个块到数据库`);

      } catch (error) {
        console.error('保存块失败:', error);
        throw error;
      }
    });
  }

  /**
   * 更新文档状态
   */
  private static async updateDocumentStatus(
    docId: string,
    chunks: CreateChunkRequest[]
  ): Promise<void> {
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.token_count, 0);
    
    await DocumentModel.update(docId, {
      ingest_status: DocumentIngestStatus.CHUNKED,
      token_estimate: totalTokens,
      metadata: {
        chunkCount: chunks.length,
        avgChunkSize: Math.floor(totalTokens / chunks.length),
        chunkingVersion: this.VERSION,
        chunkedAt: new Date().toISOString()
      }
    });
  }

  /**
   * 生成分块结果
   */
  private static generateChunkResult(
    docId: string,
    chunks: CreateChunkRequest[],
    sectionCount: number
  ): ChunkResult {
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.char_count, 0);
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.token_count, 0);
    
    const tokenCounts = chunks.map(c => c.token_count);
    const avgTokens = totalTokens / chunks.length;
    const minTokens = Math.min(...tokenCounts);
    const maxTokens = Math.max(...tokenCounts);

    // 计算重叠率
    let totalOverlap = 0;
    chunks.forEach(chunk => {
      if (chunk.overlap_with_next) {
        totalOverlap += chunk.overlap_with_next.overlap_tokens || 0;
      }
    });
    const overlapRatio = totalTokens > 0 ? totalOverlap / totalTokens : 0;

    return {
      docId,
      chunksCreated: chunks.length,
      sectionsProcessed: sectionCount,
      totalChars,
      totalTokens,
      stats: {
        avgChunkSize: Math.floor(totalChars / chunks.length),
        avgTokensPerChunk: Math.floor(avgTokens),
        minChunkSize: minTokens,
        maxChunkSize: maxTokens,
        overlapRatio
      }
    };
  }

  /**
   * 获取现有分块结果
   */
  private static async getExistingChunkResult(docId: string): Promise<ChunkResult> {
    const chunks = await DocumentChunkModel.findByDocument(docId);
    const stats = await DocumentChunkModel.getDocumentChunkStats(docId);
    
    return {
      docId,
      chunksCreated: chunks.length,
      sectionsProcessed: 0, // 无法获取
      totalChars: chunks.reduce((sum, c) => sum + c.char_count, 0),
      totalTokens: stats.totalTokens,
      stats: {
        avgChunkSize: Math.floor(stats.totalTokens / chunks.length),
        avgTokensPerChunk: Math.floor(stats.avgTokens),
        minChunkSize: 0,
        maxChunkSize: 0,
        overlapRatio: 0
      }
    };
  }

  /**
   * 更新进度
   */
  private static async updateProgress(
    onProgress: ((progress: ChunkProgress) => Promise<void>) | undefined,
    current: number,
    total: number,
    message: string,
    details?: any
  ): Promise<void> {
    if (onProgress) {
      try {
        await onProgress({
          current,
          total,
          message,
          details
        });
      } catch (error) {
        console.warn('进度更新失败:', error);
      }
    }
  }
}

export default ChunkService;