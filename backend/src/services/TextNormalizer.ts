// src/services/TextNormalizer.ts - 文本标准化服务

import { encoding_for_model, TiktokenModel } from 'tiktoken';

/**
 * 文本标准化配置
 */
export interface NormalizationConfig {
  /** 是否移除多余空白 */
  removeExtraWhitespace?: boolean;
  /** 是否标准化引号 */
  normalizeQuotes?: boolean;
  /** 是否移除控制字符 */
  removeControlChars?: boolean;
  /** 是否标准化换行符 */
  normalizeLineBreaks?: boolean;
  /** 是否移除页眉页脚 */
  removeHeaderFooter?: boolean;
  /** 是否保留段落结构 */
  preserveParagraphs?: boolean;
  /** 最小段落长度 */
  minParagraphLength?: number;
  /** 语言 */
  language?: 'zh' | 'en' | 'auto';
}

/**
 * 标准化结果
 */
export interface NormalizationResult {
  /** 清理后的文本 */
  cleanedText: string;
  /** 原始字符数 */
  originalChars: number;
  /** 清理后字符数 */
  cleanedChars: number;
  /** 估算的token数 */
  tokenCount: number;
  /** 检测到的语言 */
  detectedLanguage: string;
  /** 清理统计 */
  stats: {
    removedChars: number;
    normalizedQuotes: number;
    mergedSpaces: number;
    removedLines: number;
  };
}

/**
 * 文本标准化服务
 * 
 * 职责：
 * - 清理和标准化文本
 * - 移除无用字符和格式
 * - 统一标点符号
 * - 计算token数量
 * - 检测语言
 */
export class TextNormalizer {
  private static encoder: any = null;
  private static readonly DEFAULT_CONFIG: NormalizationConfig = {
    removeExtraWhitespace: true,
    normalizeQuotes: true,
    removeControlChars: true,
    normalizeLineBreaks: true,
    removeHeaderFooter: false,
    preserveParagraphs: true,
    minParagraphLength: 20,
    language: 'auto'
  };

  /**
   * 初始化编码器
   */
  private static initEncoder(): void {
    if (!this.encoder) {
      try {
        // 使用 cl100k_base 编码器（GPT-3.5/4 使用的）
        this.encoder = encoding_for_model('gpt-4' as TiktokenModel);
      } catch (error) {
        console.warn('无法初始化tiktoken编码器，使用估算方法');
      }
    }
  }

  /**
   * 标准化文本
   * @param text 原始文本
   * @param config 标准化配置
   * @returns 标准化结果
   */
  public static normalize(
    text: string,
    config: NormalizationConfig = {}
  ): NormalizationResult {
    const mergedConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    // 初始统计
    const originalChars = text.length;
    const stats = {
      removedChars: 0,
      normalizedQuotes: 0,
      mergedSpaces: 0,
      removedLines: 0
    };

    let cleanedText = text;

    // 1. 移除控制字符
    if (mergedConfig.removeControlChars) {
      const before = cleanedText.length;
      cleanedText = this.removeControlCharacters(cleanedText);
      stats.removedChars += before - cleanedText.length;
    }

    // 2. 标准化引号
    if (mergedConfig.normalizeQuotes) {
      const result = this.normalizeQuotes(cleanedText);
      cleanedText = result.text;
      stats.normalizedQuotes = result.count;
    }

    // 3. 标准化换行符
    if (mergedConfig.normalizeLineBreaks) {
      cleanedText = this.normalizeLineBreaks(cleanedText);
    }

    // 4. 移除页眉页脚（如果配置启用）
    if (mergedConfig.removeHeaderFooter) {
      const result = this.removeHeaderFooter(cleanedText);
      cleanedText = result.text;
      stats.removedLines += result.removedLines;
    }

    // 5. 移除多余空白
    if (mergedConfig.removeExtraWhitespace) {
      const result = this.removeExtraWhitespace(cleanedText, mergedConfig.preserveParagraphs);
      cleanedText = result.text;
      stats.mergedSpaces = result.mergedCount;
    }

    // 6. 清理段落
    if (mergedConfig.preserveParagraphs) {
      cleanedText = this.cleanParagraphs(cleanedText, mergedConfig.minParagraphLength);
    }

    // 7. 最终修剪
    cleanedText = cleanedText.trim();

    // 计算token数
    const tokenCount = this.countTokens(cleanedText);

    // 检测语言
    const detectedLanguage = mergedConfig.language === 'auto' 
      ? this.detectLanguage(cleanedText)
      : mergedConfig.language;

    return {
      cleanedText,
      originalChars,
      cleanedChars: cleanedText.length,
      tokenCount,
      detectedLanguage: detectedLanguage ?? 'unknown',
      stats
    };
  }

  /**
   * 移除控制字符
   */
  private static removeControlCharacters(text: string): string {
    // 保留换行、制表符，移除其他控制字符
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * 标准化引号
   */
  private static normalizeQuotes(text: string): { text: string; count: number } {
    let count = 0;
    let result = text;

    // 中文引号标准化
    const chineseQuotes = [
      { from: /[""]/g, to: '"' },
      { from: /['']/g, to: "'" },
      { from: /[「」]/g, to: '"' },
      { from: /[『』]/g, to: '"' }
    ];

    for (const rule of chineseQuotes) {
      const matches = result.match(rule.from);
      if (matches) {
        count += matches.length;
        result = result.replace(rule.from, rule.to);
      }
    }

    // 英文智能引号转换
    result = result.replace(/[""]/g, '"');
    result = result.replace(/['']/g, "'");

    return { text: result, count };
  }

  /**
   * 标准化换行符
   */
  private static normalizeLineBreaks(text: string): string {
    // 统一为 \n
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  /**
   * 移除页眉页脚（简单版本）
   */
  private static removeHeaderFooter(text: string): { text: string; removedLines: number } {
    const lines = text.split('\n');
    const filteredLines: string[] = [];
    let removedLines = 0;

    // 常见的页眉页脚模式
    const headerFooterPatterns = [
      /^第\s*\d+\s*页$/,           // 页码（中文）
      /^Page\s+\d+$/i,             // 页码（英文）
      /^\d+$/,                     // 纯数字页码
      /^[-_]{3,}$/,                // 分割线
      /^Copyright/i,               // 版权信息
      /^\s*\d+\s*\/\s*\d+\s*$/    // 页码格式 1/10
    ];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 检查是否匹配页眉页脚模式
      const isHeaderFooter = headerFooterPatterns.some(pattern => 
        pattern.test(trimmedLine)
      );

      if (isHeaderFooter || trimmedLine.length < 5) {
        removedLines++;
      } else {
        filteredLines.push(line);
      }
    }

    return {
      text: filteredLines.join('\n'),
      removedLines
    };
  }

  /**
   * 移除多余空白
   */
  private static removeExtraWhitespace(
    text: string, 
    preserveParagraphs: boolean = true
  ): { text: string; mergedCount: number } {
    let mergedCount = 0;
    let result = text;

    // 替换多个空格为单个空格
    const spaceMatches = result.match(/[ \t]+/g);
    if (spaceMatches) {
      mergedCount = spaceMatches.filter(m => m.length > 1).length;
    }
    result = result.replace(/[ \t]+/g, ' ');

    // 处理多余的空行
    if (preserveParagraphs) {
      // 保留段落结构，最多两个连续换行
      result = result.replace(/\n{3,}/g, '\n\n');
    } else {
      // 所有换行替换为单个空格
      result = result.replace(/\n+/g, ' ');
    }

    // 清理每行首尾空白
    if (preserveParagraphs) {
      result = result.split('\n')
        .map(line => line.trim())
        .join('\n');
    }

    return { text: result, mergedCount };
  }

  /**
   * 清理段落
   */
  private static cleanParagraphs(text: string, minLength: number = 20): string {
    const paragraphs = text.split(/\n\n+/);
    
    const cleanedParagraphs = paragraphs
      .map(p => p.trim())
      .filter(p => p.length >= minLength)
      .filter(p => {
        // 过滤掉只包含标点符号的段落
        return /\w|[\u4e00-\u9fa5]/.test(p);
      });

    return cleanedParagraphs.join('\n\n');
  }

  /**
   * 计算token数量
   */
  public static countTokens(text: string): number {
    if (!text) return 0;

    this.initEncoder();

    if (this.encoder) {
      try {
        const tokens = this.encoder.encode(text);
        return tokens.length;
      } catch (error) {
        console.warn('Token计算失败，使用估算方法');
      }
    }

    // 估算方法
    return this.estimateTokens(text);
  }

  /**
   * 估算token数量
   */
  private static estimateTokens(text: string): number {
    // 检测是否包含中文
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    
    if (hasChinese) {
      // 中文：大约1.5个字符 = 1个token
      const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      const otherChars = text.length - chineseChars;
      return Math.ceil(chineseChars / 1.5 + otherChars / 4);
    } else {
      // 英文：大约4个字符 = 1个token
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * 检测语言
   */
  private static detectLanguage(text: string): string {
    const sample = text.substring(0, 1000);
    
    // 中文检测
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
    
    // 韩文检测
    const koreanPattern = /[\uac00-\ud7af]/g;
    const koreanMatches = sample.match(koreanPattern);
    if (koreanMatches && koreanMatches.length > 10) {
      return 'ko';
    }
    
    // 默认英文
    return 'en';
  }

  /**
   * 批量标准化文本
   */
  public static async batchNormalize(
    texts: string[],
    config: NormalizationConfig = {}
  ): Promise<NormalizationResult[]> {
    const results: NormalizationResult[] = [];
    
    for (const text of texts) {
      results.push(this.normalize(text, config));
    }
    
    return results;
  }

  /**
   * 释放资源
   */
  public static cleanup(): void {
    if (this.encoder) {
      try {
        this.encoder.free();
        this.encoder = null;
      } catch (error) {
        console.warn('释放编码器资源失败:', error);
      }
    }
  }
}

export default TextNormalizer;