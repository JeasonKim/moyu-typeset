import type { StyleMap } from './theme-types';

export interface DecorationColorField {
  key: string;
  value: string;
}

const decorationFieldLabels: Readonly<Record<string, string>> = {
  accent: '强调色',
  accent_blue: '蓝色强调色',
  accent_color: '强调色',
  accent_coral: '珊瑚强调色',
  accent_mint: '薄荷强调色',
  accent_pink: '粉色强调色',
  accent_red: '红色强调色',
  accent_soft: '柔和强调色',
  accent_yellow: '黄色强调色',
  background: '背景颜色',
  bg_color: '背景颜色',
  border_color: '边框颜色',
  bubble_bg: '气泡背景',
  bubble_border: '气泡边框',
  bullet_color: '项目符号颜色',
  card_bg: '卡片背景',
  chip_bg: '标签背景',
  chip_color: '标签颜色',
  chip_text: '标签文字颜色',
  color: '颜色',
  divider_color: '分隔线颜色',
  gradient_color: '渐变颜色',
  gradient_end: '渐变结束色',
  gradient_start: '渐变起始色',
  label_bg: '标签背景',
  label_color: '标签文字颜色',
  line_color: '线条色',
  main_bg_color: '主背景颜色',
  meta_color: '辅助信息颜色',
  number_bg: '序号背景',
  number_color: '序号色',
  ornament_color: '装饰颜色',
  panel_border: '面板边框颜色',
  quote_color: '引用颜色',
  stroke_color: '描边颜色',
  sub_line_color: '辅助线颜色',
  subtitle_color: '副标题颜色',
  text_color: '文字色',
  tile_bg: '色块背景',
  title_bg: '标题背景',
  title_color: '标题色',
  underline_color: '下划线颜色',
};

export function listEditableDecorationColorFields(style: StyleMap): DecorationColorField[] {
  return Object.entries(style)
    .filter((entry): entry is [string, string] => {
      const [key, value] = entry;
      return typeof value === 'string' && (key.toLowerCase().includes('color') || isCssColorValue(value));
    })
    .map(([key, value]) => ({ key, value }));
}

export function decorationFieldLabel(fieldKey: string): string {
  return decorationFieldLabels[fieldKey] ?? fieldKey;
}

function isCssColorValue(value: string): boolean {
  const normalizedValue = value.trim();
  return (
    /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(normalizedValue) ||
    /^rgba?\(/i.test(normalizedValue) ||
    /^hsla?\(/i.test(normalizedValue) ||
    normalizedValue === 'transparent'
  );
}
