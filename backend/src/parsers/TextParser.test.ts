import { TextParser } from './TextParser';

const parser = new TextParser();

function extract(raw: string) {
  // @ts-ignore accessing protected method for testing
  const cleaned = (parser as any).cleanText(raw);
  // @ts-ignore accessing private method for testing
  return (parser as any).extractSections(cleaned, {});
}

describe('TextParser extractSections', () => {
  test('maintains correct indices for various newline styles', () => {
    const raw = 'Line1\r\n\r\nLine2\n\nLine3';
    const sections = extract(raw);
    expect(sections).toHaveLength(3);
    expect(sections[0].startChar).toBe(0);
    expect(sections[0].endChar).toBe(5);
    expect(sections[1].startChar).toBe(7);
    expect(sections[1].endChar).toBe(12);
    expect(sections[2].startChar).toBe(14);
    expect(sections[2].endChar).toBe(19);
  });
});
