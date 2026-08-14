export type StyleMap = Record<string, string | number | boolean | null | undefined>;

export interface ThemeComponent {
  enabled?: boolean;
  template?: string;
  style?: StyleMap;
  variants?: Record<string, { template?: string }>;
}

export interface ThemeRule {
  decoration?: string;
  replace_original?: boolean;
  auto_number?: boolean;
  wrap_content?: boolean;
  insert_after?: string[];
  variant?: string;
}

export interface ThemeConfig {
  base?: StyleMap;
  block?: Record<string, StyleMap>;
  inline?: Record<string, StyleMap>;
  layout?: {
    max_width?: string;
    margin?: string;
    padding?: string;
  };
  rules?: Record<string, ThemeRule>;
  components?: Record<string, ThemeComponent>;
}

export interface ThemeDefinition {
  id: string;
  value: string;
  label: string;
  labelEn?: string;
  description?: string;
  primary_color?: string;
  author?: string;
  type?: string;
  previewUrl?: string;
  section_html?: string;
  config?: ThemeConfig;
}

export interface ThemesDataset {
  themes: ThemeDefinition[];
}
