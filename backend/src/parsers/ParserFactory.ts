// src/parsers/ParserFactory.ts - 解析器工厂（更新版）

import { IParser, IParserFactory, ParseError, ParseErrorType } from '@/types/parse';

/**
 * 解析器工厂
 * 负责根据MIME类型创建合适的解析器实例
 */
export class ParserFactory implements IParserFactory {
  private static instance: ParserFactory;
  private parsers: Map<string, () => IParser> = new Map();
  
  private constructor() {
    this.registerDefaultParsers();
  }
  
  /**
   * 获取工厂单例
   */
  public static getInstance(): ParserFactory {
    if (!ParserFactory.instance) {
      ParserFactory.instance = new ParserFactory();
    }
    return ParserFactory.instance;
  }
  
  /**
   * 静态方法：创建解析器
   */
  public static createParser(mimeType: string): IParser {
    return ParserFactory.getInstance().createParserInstance(mimeType);
  }
  
  /**
   * 创建解析器实例
   */
  public createParser(mimeType: string): IParser {
    return this.createParserInstance(mimeType);
  }
  
  /**
   * 注册解析器
   */
  public registerParser(parser: IParser): void {
    parser.supportedMimeTypes.forEach(mimeType => {
      this.parsers.set(mimeType.toLowerCase(), () => parser);
    });
    
    console.log(`📝 注册解析器: ${parser.name} (支持: ${parser.supportedMimeTypes.join(', ')})`);
  }
  
  /**
   * 注册解析器构造函数
   */
  public registerParserFactory(mimeTypes: string[], factory: () => IParser): void {
    mimeTypes.forEach(mimeType => {
      this.parsers.set(mimeType.toLowerCase(), factory);
    });
  }
  
  /**
   * 获取支持的MIME类型
   */
  public getSupportedMimeTypes(): string[] {
    return Array.from(this.parsers.keys());
  }
  
  /**
   * 检查是否支持指定的MIME类型
   */
  public supports(mimeType: string): boolean {
    return this.parsers.has(mimeType.toLowerCase());
  }
  
  /**
   * 创建解析器实例（内部方法）
   */
  private createParserInstance(mimeType: string): IParser {
    const normalizedMimeType = mimeType.toLowerCase();
    const parserFactory = this.parsers.get(normalizedMimeType);
    
    if (!parserFactory) {
      throw new ParseError(
        ParseErrorType.UNSUPPORTED_FORMAT,
        `不支持的MIME类型: ${mimeType}`
      );
    }
    
    try {
      return parserFactory();
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      throw new ParseError(
        ParseErrorType.UNKNOWN_ERROR,
        `创建解析器失败: ${errorMessage}`,
        error
      );
    }
  }
  
  /**
   * 注册默认解析器
   */
  private registerDefaultParsers(): void {
    // PDF解析器 - 使用真实的PDFParser实现
    this.registerParserFactory(
      ['application/pdf'],
      () => {
        const { PDFParser } = require('@/parsers/PDFParser');
        return new PDFParser();
      }
    );
    
    // Markdown解析器 - 暂时使用占位符，后续实现
    this.registerParserFactory(
      ['text/markdown', 'text/x-markdown'],
      () => {
        const { MarkdownParser } = require('@/parsers/MarkdownParser');
        return new MarkdownParser();
      }
    );
    
    // 纯文本解析器
    this.registerParserFactory(
      ['text/plain'],
      () => {
        const { TextParser } = require('@/parsers/TextParser');
        return new TextParser();
      }
    );
    
    console.log(`🔧 解析器工厂初始化完成，支持 ${this.getSupportedMimeTypes().length} 种格式`);
    console.log(`📄 支持的格式: ${this.getSupportedMimeTypes().join(', ')}`);
  }
}

// 导出工厂类
export default ParserFactory;