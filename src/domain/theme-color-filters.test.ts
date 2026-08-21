import { describe, expect, it, vi } from 'vitest';
import { filterThemesByColor, type ThemeColorFilterId } from './theme-color-filters';
import type { ThemeAppearance, ThemeColorFamily, ThemeDefinition } from './theme-types';

interface TestThemeInput {
  id: string;
  colorFamilies: ThemeColorFamily[];
  appearance?: ThemeAppearance;
}

function testTheme(input: TestThemeInput): ThemeDefinition {
  return {
    id: input.id,
    value: input.id,
    label: input.id,
    palette: {
      colorFamilies: input.colorFamilies,
      appearance: input.appearance ?? 'light',
      primary: '#333333',
      secondary: '#B8B8B8',
    },
  };
}

const themes = [
  testTheme({ id: 'default', colorFamilies: ['monochrome'] }),
  testTheme({ id: 'swiss', colorFamilies: ['cool', 'colorful'] }),
  testTheme({ id: 'luxury', colorFamilies: ['warm'], appearance: 'dark' }),
  testTheme({ id: 'brutal', colorFamilies: ['colorful'] }),
  testTheme({ id: 'y2k', colorFamilies: ['cool', 'colorful'], appearance: 'dark' }),
];

describe('filterThemesByColor', () => {
  it('returns all themes for the all filter', () => {
    expect(filterThemesByColor(themes, 'all')).toEqual(themes);
  });

  it('filters hue families independently from the reading appearance', () => {
    expect(filterThemesByColor(themes, 'monochrome').map((theme) => theme.id)).toEqual(['default']);
    expect(filterThemesByColor(themes, 'warm').map((theme) => theme.id)).toEqual(['luxury']);
    expect(filterThemesByColor(themes, 'cool').map((theme) => theme.id)).toEqual(['swiss', 'y2k']);
    expect(filterThemesByColor(themes, 'colorful').map((theme) => theme.id)).toEqual([
      'swiss',
      'brutal',
      'y2k',
    ]);
  });

  it('logs and falls back to all themes for an unknown color filter', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(filterThemesByColor(themes, 'missing' as ThemeColorFilterId)).toEqual(themes);
    expect(warnSpy).toHaveBeenCalledWith(
      '[theme-preview] unknown theme color filter="missing". Falling back to all themes.',
    );

    warnSpy.mockRestore();
  });
});
