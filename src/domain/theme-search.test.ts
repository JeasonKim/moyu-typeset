import { describe, expect, it } from 'vitest';
import { filterThemesByQuery } from './theme-search';
import type { ThemeDefinition } from './theme-types';

const themes: ThemeDefinition[] = [
  {
    id: 'default',
    value: 'default',
    label: '清爽正文',
    labelEn: 'Default',
    palette: { colorFamilies: ['monochrome'], appearance: 'light', primary: '#333333', secondary: '#B8B8B8' },
  },
  {
    id: 'swiss',
    value: 'swiss',
    label: '荧光科技',
    labelEn: 'Swiss Tech',
    palette: { colorFamilies: ['cool'], appearance: 'light', primary: '#B8FF2C', secondary: '#236BFE' },
  },
];

describe('filterThemesByQuery', () => {
  it('keeps all themes for an empty query', () => {
    expect(filterThemesByQuery(themes, '')).toEqual(themes);
  });

  it('matches names and stable identifiers without case sensitivity', () => {
    expect(filterThemesByQuery(themes, '清爽正文')).toEqual([themes[0]]);
    expect(filterThemesByQuery(themes, 'DEFAULT')).toEqual([themes[0]]);
    expect(filterThemesByQuery(themes, 'SWISS')).toEqual([themes[1]]);
  });

  it('does not match removed usage copy or tone labels', () => {
    expect(filterThemesByQuery(themes, '趋势报告')).toEqual([]);
    expect(filterThemesByQuery(themes, '冷色')).toEqual([]);
  });
});
