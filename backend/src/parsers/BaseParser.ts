// src/parsers/BaseParser.ts - 基础解析器抽象类

import { 
  IParser, 
  ParseResult, 
  ParseConfig, 
  DocumentMetadata, 
  ParseError, 
  ParseErrorType 
} from '@/types/parse';
/**
 * 基础解析器抽象类
 * 提供所有解析器的通用功能
 */
export abstract class BaseParser implements IParser {
  public abstract readonly supportedMimeTypes: string[];
  public abstract readonly name: string;
  
  /**
   * 检查是否支持指定的MIME类型
   */
  public supports(mimeType: string): boolean {
    return this.supportedMimeTypes.includes(mimeType.toLowerCase());
  }
  
  /**
   * 抽象方法：解析文档
   */
  public abstract parse(filePath: string, config: ParseConfig): Promise<ParseResult>;
  
  /**
   * 验证文件
   */
  public async validate(filePath: string): Promise<boolean> {
    try {
      const fs = require('fs').promises;
      const stats = await fs.stat(filePath);
      
      // 检查文件是否存在且不为空
      if (!stats.isFile() || stats.size === 0) {
        return false;
      }
      
      // 子类可以重写此方法进行更具体的验证
      return await this.validateSpecific(filePath);
      
    } catch (error) {
      console.warn(`文件验证失败: ${filePath}`, error);
      return false;
    }
  }
  
  /**
   * 获取文档信息（不完整解析）
   */
  public async getInfo(filePath: string): Promise<DocumentMetadata> {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const stats = await fs.stat(filePath);
      
      return {
        title: path.basename(filePath, path.extname(filePath)),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        // 子类可以重写此方法提供更详细的信息
        ...(await this.getSpecificInfo(filePath))
      };
      
    } catch (error) {
      const message = (error instanceof Error) ? error.message : String(error);
      throw new ParseError(
        ParseErrorType.FILE_NOT_FOUND,
        `获取文档信息失败: ${message}`,
        error
      );
    }
  }
  
  /**
   * 子类特定的文件验证
   */
  protected async validateSpecific(filePath: string): Promise<boolean> {
    return true; // 默认实现，子类可以重写
  }
  
  /**
   * 子类特定的文档信息获取
   */
  protected async getSpecificInfo(filePath: string): Promise<Partial<DocumentMetadata>> {
    return {}; // 默认实现，子类可以重写
  }
  
  /**
   * 读取文件内容
   */
  protected async readFile(filePath: string): Promise<Buffer> {
    try {
      const fs = require('fs').promises;
      return await fs.readFile(filePath);
    } catch (error) {
      throw new ParseError(
        ParseErrorType.FILE_NOT_FOUND,
        `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
  
  /**
   * 检查文件大小
   */
  protected async checkFileSize(filePath: string, maxSizeMB: number = 100): Promise<void> {
    try {
      const fs = require('fs').promises;
      const stats = await fs.stat(filePath);
      const sizeMB = stats.size / (1024 * 1024);
      
      if (sizeMB > maxSizeMB) {
        throw new ParseError(
          ParseErrorType.MEMORY_LIMIT,
          `文件过大: ${sizeMB.toFixed(1)}MB，超过限制 ${maxSizeMB}MB`
        );
      }
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      throw new ParseError(
        ParseErrorType.FILE_NOT_FOUND,
        `检查文件大小失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
  
  /**
   * 通用的文本清理
   */
  protected cleanText(text: string): string {
    if (!text) return '';
    
    return text
      // 移除BOM
      .replace(/^\uFEFF/, '')
      // 标准化换行符
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 移除多余空白
      .replace(/[ \t]+/g, ' ')
      // 移除行首行尾空白
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // 移除多余的空行
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 移除首尾空白
      .trim();
  }
  
  /**
   * 生成解析统计信息
   */
  protected generateStats(
    text: string, 
    sections: any[], 
    parseTime: number,
    additionalStats?: any
  ): any {
    return {
      bytes: Buffer.byteLength(text, 'utf8'),
      sectionCount: sections.length,
      totalChars: text.length,
      parseTime,
      qualityScore: this.calculateQualityScore(text, sections),
      ...additionalStats
    };
  }
  
  /**
   * 计算内容质量评分
   */
  protected calculateQualityScore(text: string, sections: any[]): number {
    if (!text || sections.length === 0) return 0;
    
    let score = 0.5; // 基础分数
    
    // 根据章节数量调整
    if (sections.length > 0) score += 0.2;
    if (sections.length > 3) score += 0.1;
    
    // 根据文本长度调整
    const avgSectionLength = text.length / sections.length;
    if (avgSectionLength > 100) score += 0.1;
    if (avgSectionLength > 500) score += 0.1;
    
    return Math.min(score, 1.0);
  }
}