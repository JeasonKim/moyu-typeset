import { describe, expect, it, vi } from 'vitest';
import { selectPreviewTheme } from './theme-selection';
import type { ThemeDefinition } from './theme-types';

const themes: ThemeDefinition[] = [
  { id: 'default', label: '默认主题', value: 'default' },
  { id: 'z-template', label: 'Z 世代', value: 'z-template' },
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
