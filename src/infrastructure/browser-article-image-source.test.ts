import { describe, expect, it } from 'vitest';
import {
  articleImageSourceFromDirectoryHandle,
  articleImageSourceFromSelectedDirectory,
  directoryContainsOpenedArticle,
  locateOpenedArticleInSelectedDirectory,
} from './browser-article-image-source';

describe('locateOpenedArticleInSelectedDirectory', () => {
  it('finds the opened Markdown inside a selected directory hierarchy by content', async () => {
    const files = [
      selectedFile('发布包/article.md', '# 正确文章', 'text/markdown'),
      selectedFile('发布包/备份/article.md', '# 旧文章', 'text/markdown'),
      selectedFile('发布包/assets/cover.png', 'cover', 'image/png'),
    ];

    await expect(
      locateOpenedArticleInSelectedDirectory({ files, fileName: 'article.md', markdown: '# 正确文章' }),
    ).resolves.toBe('');
  });

  it('returns null when the selected directory does not contain the opened article', async () => {
    const files = [selectedFile('其他目录/article.md', '# 另一篇文章', 'text/markdown')];

    await expect(
      locateOpenedArticleInSelectedDirectory({ files, fileName: 'article.md', markdown: '# 当前文章' }),
    ).resolves.toBeNull();
  });

  it('rejects an ambiguous parent directory containing duplicate copies of the same article', async () => {
    const files = [
      selectedFile('工作区/版本一/article.md', '# 同一篇文章', 'text/markdown'),
      selectedFile('工作区/版本二/article.md', '# 同一篇文章', 'text/markdown'),
    ];

    await expect(
      locateOpenedArticleInSelectedDirectory({ files, fileName: 'article.md', markdown: '# 同一篇文章' }),
    ).resolves.toBeNull();
  });
});

describe('articleImageSourceFromSelectedDirectory', () => {
  it('resolves nested image paths relative to the matched article directory', async () => {
    const files = [
      selectedFile('工作区/文章/article.md', '# 文章', 'text/markdown'),
      selectedFile('工作区/文章/assets/cover.png', 'cover', ''),
    ];
    const source = articleImageSourceFromSelectedDirectory({ files, articleDirectoryPath: '文章' });

    await expect(source.imageDataUrl('assets/cover.png')).resolves.toBe('data:image/png;base64,Y292ZXI=');
    await expect(source.imageDataUrl('assets/missing.png')).resolves.toBeNull();
  });
});

describe('articleImageSourceFromDirectoryHandle', () => {
  it('reads only the nested image path requested by the article', async () => {
    const cover = selectedFile('cover.png', 'cover', 'image/png');
    const assetsDirectory = directoryHandle('assets', new Map([['cover.png', cover]]));
    const articleDirectory = directoryHandle('文章', new Map([['assets', assetsDirectory]]));
    const source = articleImageSourceFromDirectoryHandle(articleDirectory);

    await expect(source.imageDataUrl('assets/cover.png')).resolves.toBe('data:image/png;base64,Y292ZXI=');
    await expect(source.imageDataUrl('assets/missing.png')).resolves.toBeNull();
  });

  it('verifies that a remembered directory contains the exact opened Markdown', async () => {
    const article = selectedFile('article.md', '# 当前文章', 'text/markdown');
    const articleDirectory = directoryHandle('文章', new Map([['article.md', article]]));

    await expect(
      directoryContainsOpenedArticle(articleDirectory, { fileName: 'article.md', markdown: '# 当前文章' }),
    ).resolves.toBe(true);
    await expect(
      directoryContainsOpenedArticle(articleDirectory, { fileName: 'article.md', markdown: '# 另一篇文章' }),
    ).resolves.toBe(false);
  });
});

function selectedFile(relativePath: string, content: string, type: string): File {
  const file = new File([content], relativePath.split('/').at(-1) ?? 'file', { type });
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return file;
}

function directoryHandle(
  name: string,
  entries: Map<string, File | FileSystemDirectoryHandle>,
): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async getDirectoryHandle(entryName) {
      const entry = entries.get(entryName);
      if (entry && 'kind' in entry && entry.kind === 'directory') {
        return entry;
      }
      throw new DOMException('missing directory', 'NotFoundError');
    },
    async getFileHandle(entryName) {
      const entry = entries.get(entryName);
      if (entry instanceof File) {
        return {
          kind: 'file',
          name: entry.name,
          async getFile() {
            return entry;
          },
        } as FileSystemFileHandle;
      }
      throw new DOMException('missing file', 'NotFoundError');
    },
  } as FileSystemDirectoryHandle;
}
