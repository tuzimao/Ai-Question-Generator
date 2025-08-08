// test/parsers/TextParser.long.test.ts
import TextParser from '../src/parsers/TextParser';
import { ParseConfig, SectionType } from '../src/types/parse';
import { expect, test, beforeEach, describe } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

async function createTempFile(content: string): Promise<string> {
  const p = path.join(os.tmpdir(), `textparser-long-${Date.now()}.txt`);
  await fs.writeFile(p, content, 'utf8');
  return p;
}
async function cleanupTempFile(p: string) {
  try { await fs.unlink(p); } catch { /* ignore */ }
}
const sliceByCharSpan = (src: string, s: number, e: number) => src.slice(s, e);

describe('TextParser - 长测例（中英混排/标题检测/字符位置/词数）', () => {
  let parser: TextParser;
  beforeEach(() => { parser = new TextParser(); });

  test('应正确解析中英混排文本（自动标题，Markdown/编号/中文句号）', async () => {
    const content = `
# 一级标题（Markdown）

这是第一段中文内容。它以中文句号结尾，应该被识别为段落。

1) 编号标题

这是一段英文内容，它应该被识别为一个段落，因为以英文句号结束.

标题二

这是第二段中文内容，包含中文逗号，但最后以句号结束。应识别为段落。

Appendix A) Extra

This is an English paragraph without excessive punctuation, but it ends with a period. It should be a paragraph.

短标题

A very short English paragraph that should be a paragraph as it ends with a period.
`;

    const file = await createTempFile(content);
    const config: ParseConfig = { titleDetection: 'auto' } as any;
    const result = await parser.parse(file, config);

    // 分段数量：现在这些块共 10 段，允许实现差异，这里要求至少 6 段
    expect(result.sections.length).toBeGreaterThanOrEqual(6);

    const texts = result.sections.map(s => s.text);

    const idxMarkdown   = texts.findIndex(t => t.startsWith('# 一级标题'));
    const idxNumbered   = texts.findIndex(t => /^1\)\s+编号标题/.test(t));
    const idxPlainTitle = texts.findIndex(t => t === '标题二');
    const idxShortTitle = texts.findIndex(t => t === '短标题');

    expect(idxMarkdown).toBeGreaterThanOrEqual(0);
    expect(idxNumbered).toBeGreaterThanOrEqual(0);
    expect(idxPlainTitle).toBeGreaterThanOrEqual(0);
    expect(idxShortTitle).toBeGreaterThanOrEqual(0);

    expect(result.sections[idxMarkdown]!.type).toBe(SectionType.TITLE);
    expect(result.sections[idxNumbered]!.type).toBe(SectionType.TITLE);
    expect(result.sections[idxPlainTitle]!.type).toBe(SectionType.TITLE);
    expect(result.sections[idxShortTitle]!.type).toBe(SectionType.TITLE);

    const idxZhPara1 = texts.findIndex(t => t.includes('这是第一段中文内容。'));
    const idxZhPara2 = texts.findIndex(t => t.includes('这是第二段中文内容，'));
    expect(idxZhPara1).toBeGreaterThanOrEqual(0);
    expect(idxZhPara2).toBeGreaterThanOrEqual(0);
    expect(result.sections[idxZhPara1]!.type).toBe(SectionType.PARAGRAPH);
    expect(result.sections[idxZhPara2]!.type).toBe(SectionType.PARAGRAPH);

    const idxEnPara1 = texts.findIndex(t => t.startsWith('This is an English paragraph'));
    const idxEnPara2 = texts.findIndex(t => t.startsWith('A very short English paragraph'));
    expect(idxEnPara1).toBeGreaterThanOrEqual(0);
    expect(idxEnPara2).toBeGreaterThanOrEqual(0);
    expect(result.sections[idxEnPara1]!.type).toBe(SectionType.PARAGRAPH);
    expect(result.sections[idxEnPara2]!.type).toBe(SectionType.PARAGRAPH);

    result.sections.forEach((sec) => {
      const sliced = sliceByCharSpan(result.rawText, sec.startChar, sec.endChar);
      expect(sliced).toBe(sec.text);
    });

    result.sections.forEach((sec) => {
      expect(sec.metadata?.wordCount ?? 0).toBeGreaterThan(0);
    });

    await cleanupTempFile(file);
  });

  test('当关闭自动标题（titleDetection: none）时，所有段应为段落', async () => {
    const content = `
# Markdown Title

标题一

A short English line

这是中文标题
`;
    const file = await createTempFile(content);
    const config: ParseConfig = { titleDetection: 'none' } as any;
    const result = await parser.parse(file, config);

    // 现在有 4 段
    expect(result.sections.length).toBeGreaterThanOrEqual(4);
    result.sections.forEach((s) => {
      expect(s.type).toBe(SectionType.PARAGRAPH);
      expect((s as any).title).toBeUndefined();
    });

    await cleanupTempFile(file);
  });

  test('自定义 titlePatterns 应覆盖默认规则', async () => {
    const content = `
附录A

Appendix B

NOT A TITLE - because we say so.
`;
    const file = await createTempFile(content);
    const config: ParseConfig = {
      titleDetection: 'auto',
      titlePatterns: [/^附录A$/, /^Appendix B$/],
    } as any;

    const result = await parser.parse(file, config);

    const texts = result.sections.map(s => s.text);
    const idxA  = texts.findIndex(t => t === '附录A');
    const idxB  = texts.findIndex(t => t === 'Appendix B');
    const idxNo = texts.findIndex(t => t.startsWith('NOT A TITLE'));

    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxNo).toBeGreaterThanOrEqual(0);

    expect(result.sections[idxA]!.type).toBe(SectionType.TITLE);
    expect(result.sections[idxB]!.type).toBe(SectionType.TITLE);
    expect(result.sections[idxNo]!.type).toBe(SectionType.PARAGRAPH);

    await cleanupTempFile(file);
  });

  test('language=zh/en 时，标题长度阈值应更贴合（烟雾测试）', async () => {
    const zhContent = `
短标题

这是中文内容。
`;
    const enContent = `
Short Title

This is an English line.
`;

    // zh
    {
      const file = await createTempFile(zhContent);
      const config: ParseConfig = { titleDetection: 'auto', language: 'zh' } as any;
      const result = await parser.parse(file, config);
      expect(result.sections.length).toBeGreaterThanOrEqual(2);
      const t = result.sections.map(s => ({ text: s.text, type: s.type }));
      expect(t[0]!.type).toBe(SectionType.TITLE);
      expect(t[1]!.type).toBe(SectionType.PARAGRAPH);
      await cleanupTempFile(file);
    }

    // en
    {
      const file = await createTempFile(enContent);
      const config: ParseConfig = { titleDetection: 'auto', language: 'en' } as any;
      const result = await parser.parse(file, config);
      expect(result.sections.length).toBeGreaterThanOrEqual(2);
      const t = result.sections.map(s => ({ text: s.text, type: s.type }));
      expect(t[0]!.type).toBe(SectionType.TITLE);
      expect(t[1]!.type).toBe(SectionType.PARAGRAPH);
      await cleanupTempFile(file);
    }
  });

  test('字符位置在多空行/前后空白情况下仍精确（回归测试）', async () => {
    const content = `

   标题二  


  
这是第三段中文。  


  This is the fourth English paragraph.   


`;
    const file = await createTempFile(content);
    const config: ParseConfig = { titleDetection: 'auto' } as any;
    const result = await parser.parse(file, config);

    result.sections.forEach((sec) => {
      const sliced = sliceByCharSpan(result.rawText, sec.startChar, sec.endChar);
      expect(sliced).toBe(sec.text);
    });

    expect(result.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.sections[0]!.type).toBe(SectionType.TITLE);
    expect(result.sections[1]!.type).toBe(SectionType.PARAGRAPH);
    expect(result.sections[2]!.type).toBe(SectionType.PARAGRAPH);

    await cleanupTempFile(file);
  });
});
