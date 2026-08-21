import { describe, expect, it, vi } from 'vitest';
import { resolveThemeCardSelection, selectPreviewTheme } from './theme-selection';
import type { ThemeDefinition, ThemePalette } from './theme-types';

const testPalette: ThemePalette = {
  colorFamilies: ['monochrome'],
  appearance: 'light',
  primary: '#333333',
  secondary: '#BBBBBB',
};

const themes: ThemeDefinition[] = [
  { id: 'default', label: '默认主题', value: 'default', palette: testPalette },
  { id: 'z-template', label: 'Z 世代', value: 'z-template', palette: testPalette },
];

describe('selectPreviewTheme', () => {
  it('uses the requested theme when it exists', () => {
    const result = selectPreviewTheme({
      themes,
      requestedThemeId: 'z-template',
      storedThemeId: 'default',
    });

    expect(result.selectedThemeId).toBe('z-template');
    expect(result.source).toBe('requested');
  });

  it('falls back to stored theme and logs why a requested theme was ignored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = selectPreviewTheme({
      themes,
      requestedThemeId: 'missing',
      storedThemeId: 'default',
    });

    expect(result.selectedThemeId).toBe('default');
    expect(result.source).toBe('stored');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('requested="missing"'));

    warn.mockRestore();
  });

  it('falls back to the first theme and logs stale stored state', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = selectPreviewTheme({
      themes,
      storedThemeId: 'removed-theme',
    });

    expect(result.selectedThemeId).toBe('default');
    expect(result.source).toBe('first');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('stored="removed-theme"'));

    warn.mockRestore();
  });
});

describe('resolveThemeCardSelection', () => {
  it('selects another theme without changing the current dark appearance', () => {
    expect(resolveThemeCardSelection({
      requestedThemeId: 'z-template',
      selectedThemeId: 'default',
      pendingThemeId: null,
      currentAppearance: 'dark',
    })).toEqual({
      kind: 'activate',
      activation: {
        themeId: 'z-template',
        appearance: 'dark',
      },
    });
  });

  it('selects another theme without changing the current light appearance', () => {
    expect(resolveThemeCardSelection({
      requestedThemeId: 'z-template',
      selectedThemeId: 'default',
      pendingThemeId: null,
      currentAppearance: 'light',
    })).toEqual({
      kind: 'activate',
      activation: {
        themeId: 'z-template',
        appearance: 'light',
      },
    });
  });

  it('ignores the selected theme in either appearance and a theme already waiting to activate', () => {
    expect(resolveThemeCardSelection({
      requestedThemeId: 'default',
      selectedThemeId: 'default',
      pendingThemeId: null,
      currentAppearance: 'light',
    })).toEqual({ kind: 'ignore' });
    expect(resolveThemeCardSelection({
      requestedThemeId: 'default',
      selectedThemeId: 'default',
      pendingThemeId: null,
      currentAppearance: 'dark',
    })).toEqual({ kind: 'ignore' });
    expect(resolveThemeCardSelection({
      requestedThemeId: 'z-template',
      selectedThemeId: 'default',
      pendingThemeId: 'z-template',
      currentAppearance: 'light',
    })).toEqual({ kind: 'ignore' });
  });
});
