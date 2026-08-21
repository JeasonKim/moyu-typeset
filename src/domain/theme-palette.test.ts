import { describe, expect, it, vi } from 'vitest';
import {
  contrastRatio,
  inferThemeAppearance,
  resolveThemePaletteSurface,
} from './theme-palette';
import type { ThemeDefinition } from './theme-types';

const theme: ThemeDefinition = {
  id: 'reading-theme',
  value: 'reading-theme',
  label: '阅读主题',
  palette: {
    colorFamilies: ['warm'],
    appearance: 'light',
    primary: '#A16207',
    secondary: '#D6C4A8',
  },
  config: {
    base: {
      color: '#312C26',
      'background-color': '#FFFFFF',
    },
    block: {
      container: {
        color: '#2C2118',
        'background-color': '#FBF8F2',
      },
    },
  },
};

describe('resolveThemePaletteSurface', () => {
  it('uses the rendered article container as the palette surface source', () => {
    expect(resolveThemePaletteSurface(theme)).toEqual({
      background: '#FBF8F2',
      foreground: '#2C2118',
    });
  });

  it('logs the discarded values before falling back for an invalid theme surface', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(
      resolveThemePaletteSurface({
        ...theme,
        config: { base: { color: 'inherit', background: 'transparent' } },
      }),
    ).toEqual({ background: '#FFFFFF', foreground: '#242625' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[theme-preview] invalid palette surface theme="reading-theme" background="transparent" foreground="inherit". Falling back to background="#FFFFFF" foreground="#242625".',
    );

    warnSpy.mockRestore();
  });
});

describe('theme reading appearance', () => {
  it('classifies reading surfaces by luminance instead of accent colors', () => {
    expect(inferThemeAppearance('#F6F5F0')).toBe('light');
    expect(inferThemeAppearance('#111827')).toBe('dark');
  });

  it('calculates readable foreground and background contrast', () => {
    expect(contrastRatio('#111827', '#E5E7EB')).toBeCloseTo(14.33, 2);
  });
});
