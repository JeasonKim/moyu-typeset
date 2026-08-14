import { describe, expect, it, vi } from 'vitest';
import { filterThemesByCategory } from './template-categories';
import type { ThemeDefinition } from './theme-types';

const themes: ThemeDefinition[] = [
  { id: 'default', value: 'default', label: '清爽正文' },
  { id: 'swiss', value: 'swiss', label: '荧光科技' },
  { id: 'luxury', value: 'luxury', label: '典雅品牌' },
  { id: 'Neo Brutal Force', value: 'Neo Brutal Force', label: '粗线撞色' },
];

describe('filterThemesByCategory', () => {
  it('returns all themes for the all category', () => {
    expect(filterThemesByCategory(themes, 'all')).toEqual(themes);
  });

  it('filters themes by article-use categories', () => {
    expect(filterThemesByCategory(themes, 'daily').map((theme) => theme.id)).toEqual(['default']);
    expect(filterThemesByCategory(themes, 'business').map((theme) => theme.id)).toEqual(['swiss']);
    expect(filterThemesByCategory(themes, 'brand').map((theme) => theme.id)).toEqual(['luxury']);
    expect(filterThemesByCategory(themes, 'creative').map((theme) => theme.id)).toEqual(['Neo Brutal Force']);
  });

  it('logs and falls back to all themes for an unknown category', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(filterThemesByCategory(themes, 'missing' as never)).toEqual(themes);
    expect(warnSpy).toHaveBeenCalledWith(
      '[theme-preview] unknown template category="missing". Falling back to all templates.',
    );

    warnSpy.mockRestore();
  });
});
