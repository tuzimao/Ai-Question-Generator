// src/parsers/TextParser.ts - 纯文本解析器（占位符实现）

import { BaseParser } from './BaseParser';
import { 
  ParseResult, 
  ParseConfig, 
  ParsedSection, 
  SectionType,
  DocumentMetadata 
} from '@/types/parse';

/**
 * 纯文本解析器
 * 处理 text/plain 类型的文件
 */
export class TextParser extends BaseParser {
  public readonly supportedMimeTypes = ['text/plain'];
  public readonly name = 'TextParser';

  /**
   * 解析纯文本文档
   */
  public async parse(filePath: string, config: ParseConfig): Promise<ParseResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📄 开始解析纯文本文件: ${filePath}`);
      
      // 检查文件大小
      await this.checkFileSize(filePath, 50); // 50MB限制
      
      // 读取文件内容
      const buffer = await this.readFile(filePath);
      const rawText = buffer.toString('utf8');
      const cleanedText = this.cleanText(rawText);
      
      // 简单分段处理
      const sections = this.extractSections(cleanedText, config);
      
      // 生成文档元数据
      const metadata = await this.getInfo(filePath);
      
      // 计算统计信息
      const parseTime = Date.now() - startTime;
      const stats = this.generateStats(cleanedText, sections, parseTime);
      
      console.log(`✅ 纯文本解析完成: ${sections.length}个段落, 耗时: ${parseTime}ms`);
      
      return {
        sections,
        rawText: cleanedText,
        stats,
        metadata
      };
      
    } catch (error) {
      console.error('纯文本解析失败:', error);
      throw error;
    }
  }

  /**
   * 提取文本段落
   */
  private extractSections(text: string, config: ParseConfig): ParsedSection[] {
    const sections: ParsedSection[] = [];
    
    // 按空行分段
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChar = 0;
    
    paragraphs.forEach((paragraph, index) => {
      const trimmedParagraph = paragraph.trim();
      const startChar = currentChar;
      const endChar = startChar + trimmedParagraph.length;
      
      // 检测是否为标题
      const isTitle = this.detectTitle(trimmedParagraph, config);
      
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
          wordCount: trimmedParagraph.split(/\s+/).length
        }
      };
      if (isTitle) {
        section.title = trimmedParagraph;
      }
      sections.push(section);
      
      currentChar = endChar + 2; // 包括换行符
    });
    
    return sections;
  }

  /**
   * 检测标题
   */
  private detectTitle(text: string, config: ParseConfig): boolean {
    // 简单的标题检测规则
    if (text.length > 100) return false; // 太长不是标题
    if (text.includes('.') && text.length > 50) return false; // 包含句号且较长
    
    // 检查是否匹配标题模式
    if (config.titlePatterns) {
      return config.titlePatterns.some(pattern => pattern.test(text));
    }
    
    // 默认规则：短文本且不包含句号
    return text.length < 50 && !text.includes('.');
  }
}








// 更新 src/workers/WorkerBootstrap.ts 中的 registerWorkers 方法
/*
在 WorkerBootstrap.ts 中替换 registerWorkers 方法：

private async registerWorkers(): Promise<void> {
  // 使用更新后的 WorkerRegistry
  const workers = WorkerRegistry.createAllWorkers();
  
  for (const worker of workers) {
    this.workerManager.registerWorker(worker);
    console.log(`📝 注册Worker: ${worker.getStats().name}`);
  }
  
  if (workers.length === 0) {
    console.warn('⚠️ 没有可用的Worker被创建');
  } else {
    console.log(`✅ 成功注册 ${workers.length} 个Worker`);
  }
}
*/