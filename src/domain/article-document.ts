export type ArticleDocumentSource = 'demo' | 'file' | 'paste';

export interface ArticleDocument {
  fileName: string;
  markdown: string;
  source: ArticleDocumentSource;
}

export interface MarkdownFileDescriptor {
  name: string;
  type: string;
}

export interface MarkdownDocumentFromFileInput {
  fileName: string;
  markdown: string;
}

export function supportsMarkdownFile(file: MarkdownFileDescriptor): boolean {
  return /\.(md|markdown)$/i.test(file.name) || file.type === 'text/markdown';
}

export function markdownDocumentFromFile(input: MarkdownDocumentFromFileInput): ArticleDocument {
  return {
    fileName: input.fileName,
    markdown: input.markdown,
    source: 'file',
  };
}

export function markdownDocumentFromPaste(markdown: string): ArticleDocument {
  return {
    fileName: '粘贴文章.md',
    markdown,
    source: 'paste',
  };
}

export function articleDisplayFileName(article: ArticleDocument): string {
  return article.source === 'demo' ? '示例.md' : article.fileName;
}
