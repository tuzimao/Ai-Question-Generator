// src/parsers/MarkdownParser.ts - Markdown解析器（占位符实现）

import { BaseParser } from './BaseParser';
import { ParseResult, ParseConfig, SectionType } from '@/types/parse';

/**
 * Markdown解析器（占位符实现）
 * 后续会使用 remark 等库实现
 */
export class MarkdownParser extends BaseParser {
  public readonly supportedMimeTypes = ['text/markdown', 'text/x-markdown'];
  public readonly name = 'MarkdownParser';

  public async parse(filePath: string, config: ParseConfig): Promise<ParseResult> {
    // 占位符实现 - 返回简单的解析结果
    console.log(`📄 Markdown解析器占位符: ${filePath}`);
    
    return {
      sections: [{
        path: '1',
        title: 'Markdown文档',
        text: 'Markdown解析器尚未实现，这是占位符内容。',
        level: 1,
        startChar: 0,
        endChar: 25,
        type: SectionType.TITLE
      }],
      rawText: 'Markdown解析器尚未实现，这是占位符内容。',
      stats: {
        bytes: 100,
        sectionCount: 1,
        totalChars: 25,
        parseTime: 100,
        qualityScore: 0.5
      },
      metadata: {
        title: 'Markdown文档'
      }
    };
  }
}