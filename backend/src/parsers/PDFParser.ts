// src/parsers/PDFParser.ts - PDF解析器（占位符实现）

import { BaseParser } from './BaseParser';
import { ParseResult, ParseConfig, SectionType } from '@/types/parse';

/**
 * PDF解析器（占位符实现）
 * 后续会使用 pdf-parse 等库实现
 */
export class PDFParser extends BaseParser {
  public readonly supportedMimeTypes = ['application/pdf'];
  public readonly name = 'PDFParser';

  public async parse(filePath: string, config: ParseConfig): Promise<ParseResult> {
    // 占位符实现 - 返回简单的解析结果
    console.log(`📄 PDF解析器占位符: ${filePath}`);
    
    return {
      sections: [{
        path: '1',
        title: 'PDF文档',
        text: 'PDF解析器尚未实现，这是占位符内容。',
        level: 1,
        startChar: 0,
        endChar: 20,
        type: SectionType.TITLE,
        startPage: 1,
        endPage: 1
      }],
      rawText: 'PDF解析器尚未实现，这是占位符内容。',
      stats: {
        bytes: 100,
        sectionCount: 1,
        totalChars: 20,
        parseTime: 100,
        pageCount: 1,
        qualityScore: 0.5
      },
      metadata: {
        title: 'PDF文档'
      }
    };
  }
}