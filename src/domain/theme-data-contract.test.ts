import { describe, expect, it } from 'vitest';
import dataset from '../data/themes.json';
import { contrastRatio, inferThemeAppearance, resolveThemePaletteSurface } from './theme-palette';
import type { ThemesDataset } from './theme-types';

describe('theme dataset contract', () => {
  it('keeps one useful name and an explicit palette without usage copy', () => {
    const themes = (dataset as unknown as ThemesDataset).themes;
    const themeNames = dataset.themes.map((theme) => theme.label.trim());
    const supportedColorFamilies = new Set(['monochrome', 'warm', 'cool', 'colorful']);
    const supportedAppearances = new Set(['light', 'dark']);
    const isHexColor = (value: string) => /^#[\da-f]{6}$/i.test(value);

    expect(new Set(themeNames).size).toBe(dataset.themes.length);
    expect(dataset.themes.every((theme) => theme.label.trim().length > 0)).toBe(true);
    expect(dataset.themes.every((theme) => !Object.hasOwn(theme, 'description'))).toBe(true);
    expect(dataset.themes.every((theme) => !Object.hasOwn(theme.config?.meta ?? {}, 'description'))).toBe(true);
    expect(dataset.themes.every((theme) => !Object.hasOwn(theme, 'primary_color'))).toBe(true);
    expect(
      themes.every(
        (theme) =>
          theme.palette.colorFamilies.length > 0 &&
          theme.palette.colorFamilies.every((family) => supportedColorFamilies.has(family)) &&
          supportedAppearances.has(theme.palette.appearance) &&
          [theme.palette.primary, theme.palette.secondary].every(isHexColor) &&
          !Object.hasOwn(theme.palette, 'tones') &&
          !Object.hasOwn(theme.palette, 'background') &&
          !Object.hasOwn(theme.palette, 'foreground'),
      ),
    ).toBe(true);
  });

  it('keeps palette appearance and preview colors aligned with the rendered reading surface', () => {
    const themes = (dataset as unknown as ThemesDataset).themes;

    themes.forEach((theme) => {
      const surface = resolveThemePaletteSurface(theme);
      expect(theme.palette.appearance).toBe(inferThemeAppearance(surface.background));
      expect(contrastRatio(surface.background, surface.foreground)).toBeGreaterThanOrEqual(7);
    });
  });
});
