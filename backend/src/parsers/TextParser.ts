// src/parsers/TextParser.ts - 纯文本解析器（改进版）

import { BaseParser } from './BaseParser';
import {
  ParseResult,
  ParseConfig,
  ParsedSection,
  SectionType,
} from '@/types/parse';

export class TextParser extends BaseParser {
  public readonly supportedMimeTypes = ['text/plain'];
  public readonly name = 'TextParser';

  /**
   * 解析纯文本文档
   */
  public async parse(filePath: string, config: ParseConfig): Promise<ParseResult> {
    const startTime = Date.now();
    const debug: boolean = Boolean((config as any)?.debug ?? process.env.NODE_ENV === 'development');

    try {
      if (debug) console.log(`📄 开始解析纯文本文件: ${filePath}`);

      // 文件大小检查（50MB）
      await this.checkFileSize(filePath, 50);

      // 读取与清理文本
      const buffer = await this.readFile(filePath);
      const rawText = buffer.toString('utf8');
      const cleanedText = this.cleanText(rawText);

      // 分段
      const sections = this.extractSections(cleanedText, config);

      // 元数据与统计
      const metadata = await this.getInfo(filePath);
      const parseTime = Date.now() - startTime;
      const stats = this.generateStats(cleanedText, sections, parseTime);

      if (debug) {
        console.log(`✅ 纯文本解析完成: ${sections.length}个段落, 耗时: ${parseTime}ms`);
      }

      return {
        sections,
        rawText: cleanedText,
        stats,
        metadata,
      };
    } catch (error) {
      console.error('纯文本解析失败:', error);
      throw error;
    }
  }

  /**
   * 提取文本段落（按空行分段），并进行标题检测与字符位置标注
   */
  private extractSections(text: string, config: ParseConfig): ParsedSection[] {
    const sections: ParsedSection[] = [];

    const separatorRegex = /\n\s*\n/g;
    let match: RegExpExecArray | null;
    let currentChar = 0;
    let index = 0;

    // 逐段处理（匹配到的空行之前为一个段落）
    while ((match = separatorRegex.exec(text)) !== null) {
      const paragraph = text.slice(currentChar, match.index);

      // 计算段内前导空白，保证 startChar/endChar 精确
      const leadingWSLen = (paragraph.match(/^\s*/)?.[0].length) ?? 0;
      const trimmedParagraph = paragraph.trim();

      if (trimmedParagraph.length > 0) {
        const startChar = currentChar + leadingWSLen;
        const endChar = startChar + trimmedParagraph.length;
        const isTitle = this.detectTitle(trimmedParagraph, config, text);

        const section: ParsedSection = {
          path: (index + 1).toString(),
          text: trimmedParagraph,
          level: isTitle ? 1 : 2,
          startChar,
          endChar,
          type: isTitle ? SectionType.TITLE : SectionType.PARAGRAPH,
          confidence: 0.8,
          metadata: {
            paragraphIndex: index,
            wordCount: this.countWords(trimmedParagraph),
          },
        };

        if (isTitle) {
          // 一些上游类型把 title 设为可选，这里仅在标题时赋值
          (section as any).title = trimmedParagraph;
        }

        sections.push(section);
        index++;
      }

      // 跳过本次分隔（空行）
      currentChar = match.index + match[0].length;
    }

    // 处理最后一个段落（可能没有以空行结尾）
    const lastParagraph = text.slice(currentChar);
    if (lastParagraph.trim().length > 0) {
      const leadingWSLen = (lastParagraph.match(/^\s*/)?.[0].length) ?? 0;
      const trimmedParagraph = lastParagraph.trim();

      const startChar = currentChar + leadingWSLen;
      const endChar = startChar + trimmedParagraph.length;
      const isTitle = this.detectTitle(trimmedParagraph, config, text);

      const section: ParsedSection = {
        path: (index + 1).toString(),
        text: trimmedParagraph,
        level: isTitle ? 1 : 2,
        startChar,
        endChar,
        type: isTitle ? SectionType.TITLE : SectionType.PARAGRAPH,
        confidence: 0.8,
        metadata: {
          paragraphIndex: index,
          wordCount: this.countWords(trimmedParagraph),
        },
      };

      if (isTitle) {
        (section as any).title = trimmedParagraph;
      }

      sections.push(section);
    }

    return sections;
  }

  /**
   * 标题检测（中英适配，支持自定义模式与开关）
   * - 可通过 config.titleDetection === 'none' 关闭自动标题
   * - 可通过 config.titlePatterns 覆盖/补充规则
   */
  private detectTitle(text: string, config: ParseConfig, _fullText?: string): boolean {
    const mode = (config as any)?.titleDetection as ('auto' | 'none' | undefined);
    if (mode === 'none') return false;

    const customPatterns: RegExp[] | undefined = (config as any)?.titlePatterns;
    if (customPatterns && customPatterns.some((p) => p.test(text))) {
      return true;
    }

    // Markdown 标题 / 编号标题
    const looksLikeMarkdown = /^#{1,6}\s+\S/.test(text);
    const looksLikeNumbered = /^(\d+|[A-Za-z])[\.\)\-]\s+\S/.test(text);
    if (looksLikeMarkdown || looksLikeNumbered) return true;

    // 句末标点（中英）：以这些标点结尾 → 更像段落
    const endsLikeSentence = /[。．\.！？!?；;：:]\s*$/.test(text);

    // 行内分隔/逗号较多 → 更像段落
    const hasInternalPunct = /[，,；;、]/.test(text);

    // 中日韩脚本判断（用以设置更合理的长度阈值）
    const isCJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);

    // 如果用户指定 language，可略微调整阈值；否则自动判断
    const lang = (config as any)?.language as ('zh' | 'en' | 'auto' | undefined);
    const useCJK = lang === 'zh' ? true : lang === 'en' ? false : isCJK;

    // 标题通常更短一些
    const isShort = useCJK ? text.length <= 20 : text.length <= 60;

    // 核心规则：短、无句末符、内部标点不多 → 更像标题
    return isShort && !endsLikeSentence && !hasInternalPunct;
  }

  /**
   * 简单词数统计：英文按单词分，中文按 CJK 字符粗略计数
   */
  private countWords(text: string): number {
    const hasCJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
    if (hasCJK) {
      const cjkChars = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || [];
      return cjkChars.length;
    }
    const words = text.trim().match(/\b[\p{L}\p{N}’'-]+\b/gu) || [];
    return words.length;
  }

  /**
   * 文本清理：全角空格→半角、去控制字符、规范换行和空白、NFC 归一化
   */
  protected cleanText(text: string): string {
    if (!text) return '';

    // 全角空格 -> 半角空格
    let t = text.replace(/\u3000/g, ' ');

    // 去除控制字符（保留 \n \t），以及不可见空白
    t = t.replace(/[^\S\r\n\t]|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');

    // 去除 BOM，统一换行，压缩空白
    t = t
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    // NFC 归一化（某些平台可能不支持 normalize，但大多数环境可用）
    try {
      t = t.normalize('NFC');
    } catch {
      // ignore
    }

    return t;
  }
}

export default TextParser;
