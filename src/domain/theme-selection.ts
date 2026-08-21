import type { ThemeAppearance, ThemeDefinition } from './theme-types';

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

export interface ThemeCardSelectionInput {
  requestedThemeId: string;
  selectedThemeId: string;
  pendingThemeId: string | null;
  currentAppearance: ThemeAppearance;
}

export interface ThemeCardActivation {
  themeId: string;
  appearance: ThemeAppearance;
}

export type ThemeCardSelection =
  | { kind: 'ignore' }
  | { kind: 'activate'; activation: ThemeCardActivation };

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

export function resolveThemeCardSelection(input: ThemeCardSelectionInput): ThemeCardSelection {
  if (
    input.requestedThemeId === input.pendingThemeId ||
    input.requestedThemeId === input.selectedThemeId
  ) {
    return { kind: 'ignore' };
  }

  return {
    kind: 'activate',
    activation: {
      themeId: input.requestedThemeId,
      appearance: input.currentAppearance,
    },
  };
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
