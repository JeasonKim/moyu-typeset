import { describe, expect, it } from 'vitest';
import type { ArticleDocument } from './article-document';
import { restoreArticleDraft, serializeArticleDraft } from './article-draft';

const bundledArticle: ArticleDocument = {
  fileName: 'demo.md',
  markdown: '# 示例',
  source: 'demo',
};

describe('restoreArticleDraft', () => {
  it('restores the last valid locally saved article', () => {
    const savedArticle: ArticleDocument = {
      fileName: '产品复盘.md',
      markdown: '# 产品复盘\n\n正文',
      source: 'file',
    };

    expect(restoreArticleDraft(serializeArticleDraft(savedArticle), bundledArticle)).toEqual({
      article: savedArticle,
      status: 'restored',
    });
  });

  it('uses the bundled article without warning-worthy fallback when no draft exists', () => {
    expect(restoreArticleDraft(null, bundledArticle)).toEqual({
      article: bundledArticle,
      status: 'missing',
    });
  });

  it.each([
    ['invalid JSON', '{'],
    ['unsupported version', JSON.stringify({ version: 2, article: bundledArticle })],
    ['missing article content', JSON.stringify({ version: 1, article: { fileName: '空.md' } })],
  ])('rejects %s and reports why the saved state was abandoned', (_label, serializedDraft) => {
    const result = restoreArticleDraft(serializedDraft, bundledArticle);

    expect(result.article).toBe(bundledArticle);
    expect(result.status).toBe('invalid');
    expect(result.reason).toBeTruthy();
  });
});

