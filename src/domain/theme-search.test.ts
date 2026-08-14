import { describe, expect, it } from 'vitest';
import { filterThemesByQuery } from './theme-search';
import type { ThemeDefinition } from './theme-types';

const themes: ThemeDefinition[] = [
  { id: 'default', value: 'default', label: '清爽正文', description: '留白充足的日常长文。' },
  { id: 'swiss', value: 'swiss', label: '荧光科技', description: '适合产品分析和趋势报告。' },
];

describe('filterThemesByQuery', () => {
  it('keeps all themes for an empty query', () => {
    expect(filterThemesByQuery(themes, '')).toEqual(themes);
  });

  it('matches names, descriptions and stable identifiers without case sensitivity', () => {
    expect(filterThemesByQuery(themes, '清爽正文')).toEqual([themes[0]]);
    expect(filterThemesByQuery(themes, '趋势报告')).toEqual([themes[1]]);
    expect(filterThemesByQuery(themes, 'SWISS')).toEqual([themes[1]]);
  });

  it('matches the category users would browse for', () => {
    expect(filterThemesByQuery(themes, '日常长文')).toEqual([themes[0]]);
    expect(filterThemesByQuery(themes, '商业科技')).toEqual([themes[1]]);
  });
});
