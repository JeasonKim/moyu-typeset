import { describe, expect, it } from 'vitest';
import { highlightArticleCode } from './article-code-highlighter';

describe('highlightArticleCode', () => {
  it('highlights JSON with copy-safe inline token colors', () => {
    const result = highlightArticleCode({
      language: 'json',
      code: '{"name":"墨鱼","count":2,"ready":true}',
    });

    expect(result.highlighted).toBe(true);
    expect(result.languageLabel).toBe('JSON');
    expect(result.html).toContain('<span');
    expect(result.html).toContain('&quot;name&quot;');
  });

  it('normalizes common aliases to a registered language', () => {
    const result = highlightArticleCode({ language: 'shell', code: 'echo "moyu"' });

    expect(result.highlighted).toBe(true);
    expect(result.languageLabel).toBe('Bash');
  });

  it('keeps unknown and unlabeled code escaped without unreliable automatic detection', () => {
    const unknown = highlightArticleCode({ language: 'custom-dsl', code: '<step ready="true">' });
    const unlabeled = highlightArticleCode({ code: '<plain>' });

    expect(unknown).toEqual({
      html: '&lt;step ready=&quot;true&quot;&gt;',
      languageLabel: 'CUSTOM-DSL',
      highlighted: false,
    });
    expect(unlabeled).toEqual({
      html: '&lt;plain&gt;',
      languageLabel: '',
      highlighted: false,
    });
  });
});
