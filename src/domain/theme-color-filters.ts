import type { ThemeColorFamily, ThemeDefinition } from './theme-types';

export type ThemeColorFilterId = 'all' | ThemeColorFamily;

export interface ThemeColorFilter {
  id: ThemeColorFilterId;
  label: string;
}

export const themeColorFilters: ThemeColorFilter[] = [
  { id: 'all', label: '全部' },
  { id: 'monochrome', label: '黑白' },
  { id: 'warm', label: '暖色' },
  { id: 'cool', label: '冷色' },
  { id: 'colorful', label: '多彩' },
];

export function filterThemesByColor(themes: ThemeDefinition[], filterId: ThemeColorFilterId): ThemeDefinition[] {
  if (filterId === 'all') {
    return themes;
  }

  if (!themeColorFilters.some((item) => item.id === filterId)) {
    console.warn(`[theme-preview] unknown theme color filter="${filterId}". Falling back to all themes.`);
    return themes;
  }

  return themes.filter((theme) => theme.palette.colorFamilies.includes(filterId));
}
