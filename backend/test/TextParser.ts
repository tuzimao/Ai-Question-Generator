// test/parsers/TextParser.test.ts
import { TextParser } from '../src/parsers/TextParser';
import { ParseConfig, SectionType } from '../src/types/parse';
import { expect, test, beforeEach, describe} from '@jest/globals';


describe('TextParser', () => {
  let parser: TextParser;
  
  beforeEach(() => {
    parser = new TextParser();
  });
  
  test('应该正确解析简单文本', async () => {
    // 1. 准备测试文件
    const testContent = `标题一

这是第一段内容。

标题二

这是第二段内容。`;
    const testFilePath = await createTempFile(testContent);

    // 2. 执行解析
    const config: ParseConfig = { titleDetection: 'auto' };
    const result = await parser.parse(testFilePath, config);
    
    // 3. 验证结果
    expect(result.sections).toHaveLength(4);
    expect(result.sections[0]!.type).toBe(SectionType.TITLE);
    expect(result.sections[0]!.title).toBe('标题一');
    expect(result.sections[1]!.type).toBe(SectionType.PARAGRAPH);
    expect(result.rawText).toContain('标题一');
    
    // 4. 清理测试文件
    await cleanupTempFile(testFilePath);
  });
  
  test('应该正确计算字符位置', async () => {
    const testContent = "第一段\n\n第二段";
    const testFilePath = await createTempFile(testContent);
    
    const result = await parser.parse(testFilePath, {});
    
    expect(result.sections[0]!.startChar).toBe(0);
    expect(result.sections[0]!.endChar).toBe(3);
    expect(result.sections[1]!.startChar).toBe(5);
    expect(result.sections[1]!.endChar).toBe(8);

    await cleanupTempFile(testFilePath);
  });
});

// 测试工具函数
async function createTempFile(content: string): Promise<string> {
  const fs = require('fs').promises;
  const path = require('path');
  const os = require('os');
  
  const tempFilePath = path.join(os.tmpdir(), `test-${Date.now()}.txt`);
  await fs.writeFile(tempFilePath, content, 'utf8');
  return tempFilePath;
}

async function cleanupTempFile(filePath: string): Promise<void> {
  const fs = require('fs').promises;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // 忽略清理错误
  }
}