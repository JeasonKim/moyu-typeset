import type { ThemeDefinition } from './theme-types';

export type TemplateCategoryId = 'all' | 'daily' | 'knowledge' | 'business' | 'brand' | 'creative';

export interface TemplateCategory {
  id: TemplateCategoryId;
  label: string;
  summary: string;
  themeIds: string[];
}

export const templateCategories: TemplateCategory[] = [
  {
    id: 'all',
    label: '全部模板',
    summary: '浏览全部排版样式。',
    themeIds: [],
  },
  {
    id: 'daily',
    label: '日常长文',
    summary: '通知、随笔、社群与常规推文。',
    themeIds: ['default', 'border_less', 'minimal_pro', 'minimal_border', 'hollow_gray', 'line_art', 'warm'],
  },
  {
    id: 'knowledge',
    label: '知识教程',
    summary: '教程、方法、复盘与专业解释。',
    themeIds: [
      'default',
      'minimal_border',
      'minimal_pro',
      'geeksavvy',
      'Clay Soft Forms',
      'Studio Bulletin Editorial',
      'Monochrome Strategy Deck',
      'line_art',
    ],
  },
  {
    id: 'business',
    label: '商业科技',
    summary: '产品发布、行业观察与商业分析。',
    themeIds: [
      'swiss',
      'geeksavvy',
      'bento_grid',
      'Bento Grid',
      'Swiss International Grid',
      'Monochrome Strategy Deck',
      'Glass Aura Layers',
      'z-template',
    ],
  },
  {
    id: 'brand',
    label: '品牌故事',
    summary: '品牌故事、人文内容与生活方式。',
    themeIds: [
      'luxury',
      'refined_classic',
      'Studio Bulletin Editorial',
      'French Vintage Press',
      'Wabi Sabi Silence',
      'Literary Breath Essay',
      'chinese_style',
      'fugu',
      'warm',
    ],
  },
  {
    id: 'creative',
    label: '创意营销',
    summary: '活动、热点、营销与强视觉表达。',
    themeIds: [
      'Neo Memphis Parade',
      'Yellow Black Pulse',
      'Neo Brutal Force',
      'Y2K Chrome Dream',
      'Heavy Typography Press',
      'typography_art',
      'avant_garde',
      'z-template',
    ],
  },
];

function themeBelongsToCategory(theme: ThemeDefinition, category: TemplateCategory): boolean {
  const themeIds = new Set(category.themeIds);
  return themeIds.has(theme.value || theme.id) || themeIds.has(theme.id);
}

export function filterThemesByCategory(themes: ThemeDefinition[], categoryId: TemplateCategoryId): ThemeDefinition[] {
  if (categoryId === 'all') {
    return themes;
  }

  const category = templateCategories.find((item) => item.id === categoryId);
  if (!category) {
    console.warn(`[theme-preview] unknown template category="${categoryId}". Falling back to all templates.`);
    return themes;
  }

  return themes.filter((theme) => themeBelongsToCategory(theme, category));
}

export function describeThemeCategories(theme: ThemeDefinition): string {
  return templateCategories
    .filter((category) => category.id !== 'all' && themeBelongsToCategory(theme, category))
    .flatMap((category) => [category.label, category.summary])
    .join(' ');
}
