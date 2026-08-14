import { describe, expect, it } from 'vitest';
import { resolveConfiguredArticlePath } from './article-source-rules.mjs';

describe('resolveConfiguredArticlePath', () => {
  it('loads demo.md when no explicit article is configured', () => {
    expect(resolveConfiguredArticlePath({ environmentPath: undefined, argumentPath: undefined })).toBe('demo.md');
  });

  it('prefers environment configuration and then the command argument', () => {
    expect(resolveConfiguredArticlePath({ environmentPath: '/tmp/env.md', argumentPath: '/tmp/arg.md' })).toBe(
      '/tmp/env.md',
    );
    expect(resolveConfiguredArticlePath({ environmentPath: undefined, argumentPath: '/tmp/arg.md' })).toBe(
      '/tmp/arg.md',
    );
  });
});
