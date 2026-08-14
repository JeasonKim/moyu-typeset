import { describe, expect, it } from 'vitest';
import { themeTemplateDisplay } from './theme-display';
import type { ThemeDefinition } from './theme-types';

describe('themeTemplateDisplay', () => {
  it('uses the theme dataset as the single copy source', () => {
    const display = themeTemplateDisplay({
      id: 'Heavy Typography Press',
      value: 'Heavy Typography Press',
      label: '重磅黑白',
      description: '超粗标题与黑白高对比像报刊头版。',
    });

    expect(display).toEqual({
      name: '重磅黑白',
      summary: '超粗标题与黑白高对比像报刊头版。',
    });
  });

  it('falls back to the English label when the description is missing', () => {
    const theme: ThemeDefinition = {
      id: 'unknown',
      value: 'unknown',
      label: '未知主题',
      labelEn: 'Unknown theme',
    };

    expect(themeTemplateDisplay(theme)).toEqual({
      name: '未知主题',
      summary: 'Unknown theme',
    });
  });
});
