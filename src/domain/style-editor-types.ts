import type { StyleMap } from './theme-types';

export type TextStyleTarget = 'h1' | 'h2' | 'h3' | 'p' | 'blockquote' | 'hr';

export type EditorTab = 'text' | 'image' | 'background' | 'decoration' | 'board';

export type ShadowLevel = 'none' | 'light' | 'medium' | 'heavy';

export interface ThemeStyleOverrides {
  text: Partial<Record<TextStyleTarget, StyleMap>>;
  strong: StyleMap;
  image: {
    image: StyleMap;
    figure: StyleMap;
    figcaption: StyleMap;
  };
  background: {
    container: StyleMap;
  };
  decorations: Record<string, StyleMap>;
}

export type BoardPattern = 'off' | 'fine-grid' | 'standard-grid' | 'coarse-grid' | 'dot' | 'cross';

export interface PreviewBoardSettings {
  enabled: boolean;
  pattern: BoardPattern;
  size: number;
  opacity: number;
  color: string;
}

export interface StyleEditorState {
  activeTab: EditorTab;
  textTarget: TextStyleTarget;
  decorationTarget: string;
  overrides: ThemeStyleOverrides;
  board: PreviewBoardSettings;
}
