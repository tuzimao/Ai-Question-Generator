// src/parsers/PDFParser.ts - PDF解析器实现

import { BaseParser } from './BaseParser';
import {
  ParseResult,
  ParseConfig,
  ParsedSection,
  SectionType,
  ParseError,
  ParseErrorType,
  DocumentMetadata
} from '@/types/parse';
import { getErrorMessage } from '@/utils/typescript-helpers';

// PDF解析库类型定义
interface PDFParseResult {
  numpages: number;
  numrender: number;
  info: {
    Title?: string;
    Subject?: string;
    Author?: string;
    Keywords?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
    Trapped?: string;
    [key: string]: any;
  };
  metadata?: any;
  text: string;
  version: string;
}

// 页面渲染选项
interface PDFRenderOptions {
  pagerender?: (pageData: { pageNumber: number; pageIndex: number }) => string;
  max?: number;
  normalizeWhitespace?: boolean;
}

/**
 * PDF解析器
 * 
 * 功能特性：
 * - 使用pdf-parse库提取PDF文本内容
 * - 支持按页分割文档
 * - 提取PDF元数据（标题、作者、创建时间等）
 * - 智能识别章节标题和段落
 * - 处理多列布局和复杂格式
 */
export class PDFParser extends BaseParser {
  public readonly supportedMimeTypes = ['application/pdf'];
  public readonly name = 'PDFParser';

  /**
   * 解析PDF文档
   */
  public async parse(filePath: string, config: ParseConfig): Promise<ParseResult> {
    const startTime = Date.now();
    const debug = Boolean((config as any)?.debug ?? process.env.NODE_ENV === 'development');

    try {
      if (debug) console.log(`📄 开始解析PDF文件: ${filePath}`);

      // 检查文件大小（100MB限制）
      await this.checkFileSize(filePath, 100);

      // 读取PDF文件
      const buffer = await this.readFile(filePath);
      
      // 解析PDF
      const pdfData = await this.parsePDF(buffer, config);
      
      // 提取章节
      const sections = await this.extractSections(pdfData, config);
      
      // 提取元数据
      const metadata = this.extractMetadata(pdfData);
      
      // 计算统计信息
      const parseTime = Date.now() - startTime;
      const stats = this.generateStats(pdfData.text, sections, parseTime, {
        pageCount: pdfData.numpages,
        pdfVersion: pdfData.version,
        hasMetadata: !!pdfData.info.Title || !!pdfData.info.Author,
        detectedLanguage: this.detectLanguage(pdfData.text)
      });

      if (debug) {
        console.log(`✅ PDF解析完成: ${pdfData.numpages}页, ${sections.length}个章节, 耗时: ${parseTime}ms`);
      }

      return {
        sections,
        rawText: pdfData.text,
        stats,
        metadata
      };

    } catch (error) {
      console.error('PDF解析失败:', error);
      
      if (error instanceof ParseError) {
        throw error;
      }
      
      throw new ParseError(
        ParseErrorType.PARSING_FAILED,
        `PDF解析失败: ${getErrorMessage(error)}`,
        error
      );
    }
  }

  /**
   * 解析PDF内容
   */
    private async parsePDF(
      buffer: Buffer,
      config: ParseConfig
    ): Promise<PDFParseResult & { __pages?: string[] }> {
      try {
        const pdfParse = await import('pdf-parse');
        const pages: string[] = [];

        const data = await pdfParse.default(buffer, {
          normalizeWhitespace: config.preserveFormatting !== false,
          pagerender: async (pageData: any) => {
            const tc = await pageData.getTextContent();
            const pageText = (tc.items || []).map((it: any) => it.str ?? '').join('\n');
            pages.push(pageText);
            return `\n<<PAGE_${pageData.pageNumber}_START>>\n${pageText}`;
          },
        } as any);

        (data as any).__pages = pages;

        if ((!data || !data.text) && pages.length === 0) {
          throw new ParseError(
            ParseErrorType.FILE_CORRUPTED,
            'PDF文件无法解析或不包含文本内容'
          );
        }
        return data as PDFParseResult & { __pages?: string[] };
      } catch (error) {
        if (error instanceof ParseError) throw error;
        throw new ParseError(
          ParseErrorType.PARSING_FAILED,
          `PDF解析库错误: ${getErrorMessage(error)}`,
          error
        );
      }
    }

  /**
   * 提取文档章节
   */
  private async extractSections(
    pdfData: PDFParseResult, 
    config: ParseConfig
  ): Promise<ParsedSection[]> {
    const sections: ParsedSection[] = [];
    
    // 按页分割文本
    const pageTexts = ((pdfData as any).__pages as string[]) ?? this.splitByPages(pdfData.text);
    
    // 计算字符偏移量
    let currentCharOffset = 0;
    
    // 处理每一页
    for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex++) {
      const pageText = pageTexts[pageIndex];
      const pageNumber = pageIndex + 1;
      
      if (!pageText || pageText.trim().length === 0) {
        // 跳过空白页
        currentCharOffset += (pageText ?? '').length;
        continue;
      }
      
      // 根据配置决定分段策略
      if (this.shouldSplitIntoSections(config)) {
        // 智能分段：识别标题和段落
        const pageSections = this.extractPageSections(
          pageText, 
          pageNumber, 
          currentCharOffset,
          config
        );
        sections.push(...pageSections);
      } else {
        // 简单模式：每页作为一个章节
        const section: ParsedSection = {
          path: `page_${pageNumber}`,
          title: `第 ${pageNumber} 页`,
          text: this.cleanText(pageText),
          level: 1,
          startChar: currentCharOffset,
          endChar: currentCharOffset + pageText.length,
          startPage: pageNumber,
          endPage: pageNumber,
          type: SectionType.PARAGRAPH,
          confidence: 0.9,
          metadata: {
            pageNumber,
            source: 'pdf-parse',
            textLength: pageText.length
          }
        };
        sections.push(section);
      }
      
      currentCharOffset += pageText.length;
    }
    
    // 如果没有提取到任何章节，创建一个默认章节
    if (sections.length === 0 && pdfData.text.trim().length > 0) {
      sections.push({
        path: 'document',
        title: '文档内容',
        text: this.cleanText(pdfData.text),
        level: 1,
        startChar: 0,
        endChar: pdfData.text.length,
        startPage: 1,
        endPage: pdfData.numpages,
        type: SectionType.PARAGRAPH,
        confidence: 0.5
      });
    }
    
    return sections;
  }

  /**
   * 按页分割文本
   */
  private splitByPages(text: string): string[] {
    // 使用我们自定义的页面标记分割
    const pagePattern = /<<PAGE_(\d+)_START>>/g;
    const pages: string[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = pagePattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        // 提取页面内容（去除标记本身）
        const pageContent = text.substring(lastIndex, match.index);
        if (pages.length > 0 || pageContent.trim()) {
          pages.push(pageContent);
        }
      }
      lastIndex = match.index + match[0].length;
    }
    
    // 添加最后一页
    if (lastIndex < text.length) {
      pages.push(text.substring(lastIndex));
    }
    
    // 如果没有找到页面标记，将整个文本作为一页
    if (pages.length === 0) {
      pages.push(text);
    }
    
    return pages;
  }

  /**
   * 智能提取页面内的章节
   */
  private extractPageSections(
  pageText: string,
  pageNumber: number,
  charOffset: number,
  config: ParseConfig
): ParsedSection[] {
  const sections: ParsedSection[] = [];

  // 按空行分段（容忍 \r\n / \n，并允许中间有少量空白）
  const paragraphs = pageText.split(/\r?\n\s*\r?\n/);

  // 注意：currentOffset 始终用「原始段落」长度推进，保证与原文字符位置一致
  let currentOffset = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const raw = paragraphs[i] ?? '';
    const trimmed = raw.trim();

    if (!trimmed) {
      currentOffset += raw.length;
      continue;
    }

    // 在原始段落中找到去掉前后空白后的相对起点，确保偏移与原文一致
    const relStart = raw.indexOf(trimmed);
    const startChar = charOffset + currentOffset + Math.max(0, relStart);

    // endChar 使用 trimmed 的长度计算，保持与原文（去首尾空白后）的区间对应
    //（注意：如果 cleanText 会改变长度，偏移仍以 trimmed 为准，避免错位）
    const endChar = startChar + trimmed.length;

    // 标题检测与层级
    const isTitle = this.detectTitle(trimmed, config);
    const level = isTitle ? this.detectTitleLevel(trimmed) : 2;

    // 展示文本：可以做轻度清理，但不要影响偏移的计算（偏移已按 trimmed 计算）
    const textForDisplay = this.cleanText(trimmed);

    const section: ParsedSection = {
      path: `page_${pageNumber}_section_${i + 1}`,
      title: isTitle ? textForDisplay : '', // Always provide a string for title
      text: textForDisplay,
      level,
      startChar,
      endChar,
      startPage: pageNumber,
      endPage: pageNumber,
      type: isTitle ? SectionType.HEADING : SectionType.PARAGRAPH,
      confidence: this.calculateConfidence(trimmed, isTitle),
      metadata: {
        source: 'pdf-parse',
        pageNumber,
        paragraphIndex: i,
        textLength: trimmed.length,
        wordCount: this.countWords(trimmed)
      }
    };

    sections.push(section);

    // 用原始段落的长度推进 offset，确保下一段的相对位置正确
    currentOffset += raw.length;
  }

  return sections;
}

/**
 * 检测是否为标题
 */
private detectTitle(text: string, config: ParseConfig): boolean {
  // 如果禁用标题检测
    if ((config as any)?.titleDetection === 'none') {
      return false;
    }
    
    // 自定义标题模式
    const customPatterns = (config as any)?.titlePatterns as RegExp[] | undefined;
    if (customPatterns?.some(p => p.test(text))) {
      return true;
    }
    
    // PDF常见标题模式
    const titlePatterns = [
      /^第[一二三四五六七八九十\d]+[章节部分]/,     // 中文章节
      /^Chapter\s+\d+/i,                          // Chapter X
      /^Section\s+\d+/i,                          // Section X
      /^\d+(\.\d+)*\s+\S/,                        // 1.2.3 标题
      /^[A-Z][A-Z\s]{2,50}$/,                     // 全大写标题
      /^(Abstract|Introduction|Conclusion|References|Appendix)/i,  // 常见章节名
      /^[一二三四五六七八九十]+[、.]\s*\S/        // 中文编号
    ];
    
    // 检查是否匹配标题模式
    if (titlePatterns.some(pattern => pattern.test(text))) {
      return true;
    }
    
    // 基于长度和标点判断
    const hasEndPunctuation = /[。．.！!？?；;：:]$/.test(text);
    const isShort = text.length < 50;
    const hasInternalPunctuation = /[，,；;、]/.test(text);
    
    // 短文本、无句末标点、无内部标点 -> 可能是标题
    return isShort && !hasEndPunctuation && !hasInternalPunctuation;
  }

  /**
   * 检测标题级别
   */
  private detectTitleLevel(text: string): number {
    // 根据标题特征判断级别
    if (/^(第[一二三四五六七八九十\d]+[部篇]|Part\s+[IVX\d]+)/i.test(text)) {
      return 1; // 部/篇级别
    }
    
    if (/^(第[一二三四五六七八九十\d]+章|Chapter\s+\d+)/i.test(text)) {
      return 1; // 章级别
    }
    
    if (/^(第[一二三四五六七八九十\d]+节|Section\s+\d+|\d+\.\d+\s)/i.test(text)) {
      return 2; // 节级别
    }
    
    if (/^\d+\.\d+\.\d+\s/.test(text)) {
      return 3; // 子节级别
    }
    
    // 默认为2级
    return 2;
  }

  /**
   * 计算置信度分数
   */
  private calculateConfidence(text: string, isTitle: boolean): number {
    let confidence = 0.7; // 基础分数
    
    if (isTitle) {
      // 标题的置信度调整
      if (/^(第|Chapter|Section|\d+\.)/i.test(text)) {
        confidence += 0.2; // 明确的标题标记
      }
      if (text.length < 30) {
        confidence += 0.05; // 短标题
      }
    } else {
      // 段落的置信度调整
      if (text.length > 100) {
        confidence += 0.1; // 长段落
      }
      if (/[。．.！!？?]$/.test(text)) {
        confidence += 0.1; // 完整句子
      }
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 提取PDF元数据
   */
  private extractMetadata(pdfData: PDFParseResult): DocumentMetadata {
    const info = pdfData.info || {};
    
    return {
      title: info.Title,
      author: info.Author,
      subject: info.Subject,
      producer: info.Producer,
      pdfVersion: pdfData.version,
      createdAt: info.CreationDate ? this.parseDate(info.CreationDate) : undefined,
      modifiedAt: info.ModDate ? this.parseDate(info.ModDate) : undefined,
      encrypted: info.IsEncrypted || false,
      customProperties: {
        keywords: info.Keywords,
        creator: info.Creator,
        trapped: info.Trapped,
        pageCount: pdfData.numpages,
        ...pdfData.metadata
      }
    };
  }

  /**
   * 解析PDF日期格式
   */
  private parseDate(dateStr: string): Date | undefined {
    try {
      // PDF日期格式: D:YYYYMMDDHHmmSSOHH'mm
      const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
      if (match) {
        const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
        return new Date(
          parseInt(year), 
          parseInt(month) - 1, 
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
      }
      
      // 尝试标准日期解析
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? undefined : date;
      
    } catch {
      return undefined;
    }
  }

  /**
   * 检测文档语言
   */
  private detectLanguage(text: string): string {
    // 简单的语言检测逻辑
    const sample = text.substring(0, 1000);
    
    // 中文字符检测
    const chinesePattern = /[\u4e00-\u9fa5]/g;
    const chineseMatches = sample.match(chinesePattern);
    const chineseRatio = chineseMatches ? chineseMatches.length / sample.length : 0;
    
    if (chineseRatio > 0.3) {
      return 'zh';
    }
    
    // 日文检测
    const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/g;
    const japaneseMatches = sample.match(japanesePattern);
    if (japaneseMatches && japaneseMatches.length > 10) {
      return 'ja';
    }
    
    // 默认为英文
    return 'en';
  }

  /**
   * 判断是否需要智能分段
   */
  private shouldSplitIntoSections(config: ParseConfig): boolean {
    // 如果配置明确指定
    const smartSplit = (config as any)?.smartSplit;
    if (smartSplit !== undefined) {
      return smartSplit;
    }
    
    // 默认启用智能分段
    return true;
  }

  /**
   * 统计词数
   */
  private countWords(text: string): number {
    // 检测是否包含中文
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
   * 验证PDF文件
   */
  protected async validateSpecific(filePath: string): Promise<boolean> {
    try {
      const buffer = await this.readFile(filePath);
      
      // 检查PDF文件头
      const header = buffer.slice(0, 5).toString('ascii');
      return header === '%PDF-';
      
    } catch {
      return false;
    }
  }

  /**
   * 获取PDF特定信息
   */
  protected async getSpecificInfo(filePath: string): Promise<Partial<DocumentMetadata>> {
    try {
      const buffer = await this.readFile(filePath);
      const pdfData = await this.parsePDF(buffer, {});
      return this.extractMetadata(pdfData);
    } catch {
      return {};
    }
  }
}

// 导出解析器
export default PDFParser;