import { describe, expect, it } from 'vitest';
import {
  createEmptyStyleOverrides,
  createPristineEditorState,
  focusStyleEditorOnBodyText,
  resetStyleEditorToOriginal,
} from './style-editor-state';

describe('style editor state', () => {
  it('creates empty overrides with board disabled for the original theme look', () => {
    const state = createPristineEditorState('hero');

    expect(state.textTarget).toBe('p');
    expect(state.overrides).toEqual(createEmptyStyleOverrides());
    expect(state.decorationPreferences.sectionDividerEnabled).toBe(false);
    expect(state.board.enabled).toBe(false);
    expect(state.board.pattern).toBe('off');
  });

  it('defaults a restored legacy editor to hidden section dividers', () => {
    const legacyState = createPristineEditorState('hero');
    delete (legacyState as Partial<typeof legacyState>).decorationPreferences;

    const restoredState = focusStyleEditorOnBodyText(legacyState);

    expect(restoredState.decorationPreferences.sectionDividerEnabled).toBe(false);
  });

  it('opens a restored editor at body text while preserving custom styles', () => {
    const state = createPristineEditorState('hero');
    state.textTarget = 'h1';
    state.overrides.text.p = { 'font-size': '18px' };

    const restoredState = focusStyleEditorOnBodyText(state);

    expect(restoredState.textTarget).toBe('p');
    expect(restoredState.overrides.text.p).toEqual({ 'font-size': '18px' });
  });

  it('resets custom style data while keeping the current editor location', () => {
    const state = createPristineEditorState('hero');
    state.activeTab = 'image';
    state.textTarget = 'h2';
    state.overrides.text.h2 = { color: '#ffffff' };
    state.board.enabled = true;
    state.board.pattern = 'fine-grid';

    const resetState = resetStyleEditorToOriginal(state, 'quote');

    expect(resetState.activeTab).toBe('image');
    expect(resetState.textTarget).toBe('h2');
    expect(resetState.decorationTarget).toBe('quote');
    expect(resetState.overrides).toEqual(createEmptyStyleOverrides());
    expect(resetState.decorationPreferences.sectionDividerEnabled).toBe(false);
    expect(resetState.board.enabled).toBe(false);
    expect(resetState.board.pattern).toBe('off');
  });
});
