import { describe, expect, it } from 'vitest';
import {
  articleDisplayFileName,
  markdownDocumentFromFile,
  markdownDocumentFromPaste,
  supportsMarkdownFile,
} from './article-document';

describe('supportsMarkdownFile', () => {
  it('accepts Markdown extensions and rejects unrelated files', () => {
    expect(supportsMarkdownFile({ name: 'article.md', type: '' })).toBe(true);
    expect(supportsMarkdownFile({ name: 'ARTICLE.MARKDOWN', type: 'text/markdown' })).toBe(true);
    expect(supportsMarkdownFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
  });
});

describe('markdownDocumentFromFile', () => {
  it('keeps the opened file name and content in memory', () => {
    expect(markdownDocumentFromFile({ fileName: '产品说明.md', markdown: '# 产品说明' })).toEqual({
      fileName: '产品说明.md',
      markdown: '# 产品说明',
      source: 'file',
    });
  });
});

describe('markdownDocumentFromPaste', () => {
  it('uses a recognizable temporary name for pasted content', () => {
    expect(markdownDocumentFromPaste('# 粘贴文章')).toEqual({
      fileName: '粘贴文章.md',
      markdown: '# 粘贴文章',
      source: 'paste',
    });
  });
});

describe('articleDisplayFileName', () => {
  it('shows the bundled demo as 示例.md without changing uploaded Chinese file names', () => {
    expect(articleDisplayFileName({ fileName: 'demo.md', markdown: '', source: 'demo' })).toBe('示例.md');
    expect(articleDisplayFileName({ fileName: '中文文章.md', markdown: '', source: 'file' })).toBe('中文文章.md');
  });
});
