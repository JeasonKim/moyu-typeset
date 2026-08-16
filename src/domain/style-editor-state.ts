import type {
  StyleEditorState,
  ThemeDecorationPreferences,
  ThemeStyleOverrides,
} from './style-editor-types';

function createDefaultDecorationPreferences(): ThemeDecorationPreferences {
  return {
    sectionDividerEnabled: false,
  };
}

export function createEmptyStyleOverrides(): ThemeStyleOverrides {
  return {
    text: {},
    strong: {},
    image: {
      image: {},
      figure: {},
      figcaption: {},
    },
    background: {
      container: {},
    },
    decorations: {},
  };
}

export function createPristineEditorState(decorationTarget: string): StyleEditorState {
  return {
    activeTab: 'text',
    textTarget: 'p',
    decorationTarget,
    decorationPreferences: createDefaultDecorationPreferences(),
    overrides: createEmptyStyleOverrides(),
    board: {
      enabled: false,
      pattern: 'off',
      size: 15,
      opacity: 30,
      color: '#F59E0B',
    },
  };
}

export function focusStyleEditorOnBodyText(editorState: StyleEditorState): StyleEditorState {
  return {
    ...editorState,
    textTarget: 'p',
    decorationPreferences: {
      ...createDefaultDecorationPreferences(),
      ...editorState.decorationPreferences,
    },
  };
}

export function resetStyleEditorToOriginal(
  currentState: StyleEditorState,
  decorationTarget: string,
): StyleEditorState {
  return {
    ...createPristineEditorState(decorationTarget),
    activeTab: currentState.activeTab,
    textTarget: currentState.textTarget,
  };
}
