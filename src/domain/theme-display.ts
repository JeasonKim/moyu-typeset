import type { ThemeDefinition } from './theme-types';

export interface ThemeTemplateDisplay {
  name: string;
  summary: string;
}

export function themeTemplateDisplay(theme: ThemeDefinition): ThemeTemplateDisplay {
  return {
    name: theme.label,
    summary: theme.description || theme.labelEn || theme.label,
  };
}
