import type { ThemeDefinition } from './theme-types';

export interface ThemeSelectionInput {
  themes: ThemeDefinition[];
  requestedThemeId?: string | null;
  storedThemeId?: string | null;
}

export interface ThemeSelectionResult {
  selectedTheme: ThemeDefinition;
  selectedThemeId: string;
  source: 'requested' | 'stored' | 'first';
}

export function selectPreviewTheme(input: ThemeSelectionInput): ThemeSelectionResult {
  const { themes, requestedThemeId, storedThemeId } = input;
  if (themes.length === 0) {
    throw new Error('No themes available.');
  }

  const requestedTheme = matchTheme(themes, requestedThemeId);
  if (requestedTheme) {
    return selectedFrom(requestedTheme, 'requested');
  }

  if (requestedThemeId) {
    console.warn(
      `[theme-preview] requested theme ignored requested="${requestedThemeId}" available="${themes
        .map((theme) => theme.value || theme.id)
        .join(',')}". Falling back to stored/first theme.`,
    );
  }

  const storedTheme = matchTheme(themes, storedThemeId);
  if (storedTheme) {
    return selectedFrom(storedTheme, 'stored');
  }

  if (storedThemeId) {
    console.warn(
      `[theme-preview] stored theme abandoned stored="${storedThemeId}" first="${themes[0].value || themes[0].id}".`,
    );
  }

  return selectedFrom(themes[0], 'first');
}

function matchTheme(themes: ThemeDefinition[], themeId?: string | null): ThemeDefinition | undefined {
  if (!themeId) {
    return undefined;
  }

  return themes.find((theme) => theme.value === themeId || theme.id === themeId);
}

function selectedFrom(theme: ThemeDefinition, source: ThemeSelectionResult['source']): ThemeSelectionResult {
  const selectedThemeId = theme.value || theme.id;
  return {
    selectedTheme: theme,
    selectedThemeId,
    source,
  };
}
