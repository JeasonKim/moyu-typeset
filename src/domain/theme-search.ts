import type { ThemeDefinition } from './theme-types';
import { describeThemeCategories } from './template-categories';

export function filterThemesByQuery(themes: ThemeDefinition[], query: string): ThemeDefinition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return themes;
  }

  return themes.filter((theme) => {
    const searchableText = [
      theme.id,
      theme.value,
      theme.label,
      theme.labelEn,
      theme.description,
      describeThemeCategories(theme),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
