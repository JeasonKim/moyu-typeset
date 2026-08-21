import type { ArticleDocument, ArticleDocumentSource } from './article-document';

export type ArticleDraftRestorationStatus = 'missing' | 'restored' | 'invalid';

export interface ArticleDraftRestoration {
  article: ArticleDocument;
  status: ArticleDraftRestorationStatus;
  reason?: string;
}

interface ArticleDraftSnapshot {
  version: 1;
  article: ArticleDocument;
}

const articleDocumentSources: ArticleDocumentSource[] = ['demo', 'file', 'paste'];

export function serializeArticleDraft(article: ArticleDocument): string {
  const snapshot: ArticleDraftSnapshot = {
    version: 1,
    article,
  };
  return JSON.stringify(snapshot);
}

export function restoreArticleDraft(
  serializedDraft: string | null,
  fallbackArticle: ArticleDocument,
): ArticleDraftRestoration {
  if (serializedDraft === null) {
    return { article: fallbackArticle, status: 'missing' };
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(serializedDraft);
  } catch (error) {
    return {
      article: fallbackArticle,
      status: 'invalid',
      reason: `draft JSON could not be parsed: ${String(error)}`,
    };
  }

  if (!isRecord(candidate) || candidate.version !== 1) {
    return {
      article: fallbackArticle,
      status: 'invalid',
      reason: `unsupported draft version=${isRecord(candidate) ? String(candidate.version) : 'unknown'}`,
    };
  }

  if (!isArticleDocument(candidate.article)) {
    return {
      article: fallbackArticle,
      status: 'invalid',
      reason: 'draft article fields are incomplete',
    };
  }

  return { article: candidate.article, status: 'restored' };
}

function isArticleDocument(value: unknown): value is ArticleDocument {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.fileName === 'string' &&
    value.fileName.length > 0 &&
    typeof value.markdown === 'string' &&
    typeof value.source === 'string' &&
    articleDocumentSources.includes(value.source as ArticleDocumentSource)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

