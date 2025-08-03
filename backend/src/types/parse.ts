// src/types/parse.ts - 文档解析相关类型定义

/**
 * 解析后的文档章节
 */
export interface ParsedSection {
  /** 章节路径（如 "1", "1.2", "1.2.3"） */
  path: string;
  /** 章节标题 */
  title?: string;
  /** 章节内容 */
  text: string;
  /** 起始页码（PDF特有） */
  startPage?: number;
  /** 结束页码（PDF特有） */
  endPage?: number;
  /** 章节级别（1为顶级） */
  level: number;
  /** 在文档中的字符位置 */
  startChar: number;
  endChar: number;
  /** 章节类型 */
  type: SectionType;
  /** 置信度分数 */
  confidence?: number;
  /** 扩展元数据 */
  metadata?: Record<string, any>;
}

/**
 * 章节类型枚举
 */
export enum SectionType {
  TITLE = 'title',           // 标题
  HEADING = 'heading',       // 章节标题
  PARAGRAPH = 'paragraph',   // 段落
  LIST = 'list',            // 列表
  TABLE = 'table',          // 表格
  CODE = 'code',            // 代码块
  QUOTE = 'quote',          // 引用
  FORMULA = 'formula',      // 公式
  IMAGE = 'image',          // 图片
  FOOTNOTE = 'footnote',    // 脚注
  HEADER = 'header',        // 页眉
  FOOTER = 'footer',        // 页脚
  TOC = 'toc',             // 目录
  UNKNOWN = 'unknown'       // 未知类型
}

/**
 * 解析结果接口
 */
export interface ParseResult {
  /** 解析后的章节列表 */
  sections: ParsedSection[];
  /** 全文原始文本 */
  rawText: string;
  /** 解析统计信息 */
  stats: ParseStats;
  /** 文档元数据 */
  metadata: DocumentMetadata;
}

/**
 * 解析统计信息
 */
export interface ParseStats {
  /** 页数（PDF特有） */
  pageCount?: number;
  /** 原始字节数 */
  bytes: number;
  /** 章节数量 */
  sectionCount: number;
  /** 字符总数 */
  totalChars: number;
  /** 估算的token数量 */
  estimatedTokens?: number;
  /** 解析耗时（毫秒） */
  parseTime: number;
  /** 解析质量评分（0-1） */
  qualityScore?: number;
  /** 检测到的语言 */
  detectedLanguage?: string;
}

/**
 * 文档元数据
 */
export interface DocumentMetadata {
  /** 文档标题 */
  title?: string;
  /** 作者 */
  author?: string;
  /** 创建时间 */
  createdAt?: Date;
  /** 修改时间 */
  modifiedAt?: Date;
  /** 主题/关键词 */
  subject?: string;
  /** 生产者/工具 */
  producer?: string;
  /** PDF版本 */
  pdfVersion?: string;
  /** 是否加密 */
  encrypted?: boolean;
  /** 自定义属性 */
  customProperties?: Record<string, any>;
}

/**
 * 解析配置
 */
export interface ParseConfig {
  /** 是否提取图片 */
  extractImages?: boolean;
  /** 是否保留格式 */
  preserveFormatting?: boolean;
  /** 标题检测模式 */
  titleDetection?: 'auto' | 'pattern' | 'font' | 'disabled';
  /** 自定义标题模式 */
  titlePatterns?: RegExp[];
  /** 最大章节长度 */
  maxSectionLength?: number;
  /** 是否清理页眉页脚 */
  cleanHeaderFooter?: boolean;
  /** 语言提示 */
  languageHint?: string;
  /** 质量阈值 */
  qualityThreshold?: number;
}

/**
 * 解析器类型枚举
 */
export enum ParserType {
  PDF = 'pdf',
  MARKDOWN = 'markdown',
  TEXT = 'text',
  HTML = 'html',
  DOCX = 'docx'
}

/**
 * 解析错误类型
 */
export enum ParseErrorType {
  FILE_NOT_FOUND = 'file_not_found',
  FILE_CORRUPTED = 'file_corrupted',
  UNSUPPORTED_FORMAT = 'unsupported_format',
  PARSING_FAILED = 'parsing_failed',
  TIMEOUT = 'timeout',
  MEMORY_LIMIT = 'memory_limit',
  PERMISSION_DENIED = 'permission_denied',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * 解析错误类
 */
export class ParseError extends Error {
  public readonly type: ParseErrorType;
  public readonly details?: any;
  
  constructor(type: ParseErrorType, message: string, details?: any) {
    super(message);
    this.name = 'ParseError';
    this.type = type;
    this.details = details;
  }
}

/**
 * 文档解析请求
 */
export interface ParseRequest {
  /** 文档ID */
  docId: string;
  /** 用户ID */
  userId: string;
  /** 文件路径 */
  filePath: string;
  /** 存储桶 */
  bucket: string;
  /** MIME类型 */
  mimeType: string;
  /** 解析配置 */
  config: ParseConfig;
  /** 优先级 */
  priority?: number;
}

/**
 * 解析进度信息
 */
export interface ParseProgress {
  /** 当前阶段 */
  stage: ParseStage;
  /** 进度百分比 */
  percentage: number;
  /** 当前消息 */
  message: string;
  /** 已处理页数/章节数 */
  processed: number;
  /** 总页数/章节数 */
  total: number;
  /** 估算剩余时间（秒） */
  estimatedTimeRemaining?: number;
  /** 详细信息 */
  details?: Record<string, any>;
}

/**
 * 解析阶段枚举
 */
export enum ParseStage {
  INITIALIZING = 'initializing',     // 初始化
  READING_FILE = 'reading_file',     // 读取文件
  PARSING_CONTENT = 'parsing_content', // 解析内容
  EXTRACTING_SECTIONS = 'extracting_sections', // 提取章节
  NORMALIZING_TEXT = 'normalizing_text', // 标准化文本
  DETECTING_LANGUAGE = 'detecting_language', // 语言检测
  CALCULATING_TOKENS = 'calculating_tokens', // 计算tokens
  SAVING_RESULTS = 'saving_results',  // 保存结果
  COMPLETED = 'completed',           // 完成
  FAILED = 'failed'                  // 失败
}

/**
 * 解析器接口
 */
export interface IParser {
  /** 支持的MIME类型 */
  readonly supportedMimeTypes: string[];
  
  /** 解析器名称 */
  readonly name: string;
  
  /**
   * 检查是否支持指定的MIME类型
   */
  supports(mimeType: string): boolean;
  
  /**
   * 解析文档
   */
  parse(filePath: string, config: ParseConfig): Promise<ParseResult>;
  
  /**
   * 验证文件
   */
  validate(filePath: string): Promise<boolean>;
  
  /**
   * 获取文档信息（不完整解析）
   */
  getInfo(filePath: string): Promise<DocumentMetadata>;
}

/**
 * 解析器工厂接口
 */
export interface IParserFactory {
  /**
   * 根据MIME类型创建解析器
   */
  createParser(mimeType: string): IParser;
  
  /**
   * 注册解析器
   */
  registerParser(parser: IParser): void;
  
  /**
   * 获取支持的MIME类型列表
   */
  getSupportedMimeTypes(): string[];
}