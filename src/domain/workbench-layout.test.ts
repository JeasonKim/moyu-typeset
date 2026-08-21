import { describe, expect, it } from 'vitest';
import { constrainMarkdownPaneWidth, resizeRightMarkdownPane } from './workbench-layout';

describe('constrainMarkdownPaneWidth', () => {
  it('keeps the requested editor width when both panes remain readable', () => {
    expect(
      constrainMarkdownPaneWidth({
        workbenchWidth: 1_100,
        requestedWidth: 440,
        dividerWidth: 12,
        minimumMarkdownWidth: 320,
        minimumPreviewWidth: 430,
      }),
    ).toBe(440);
  });

  it('protects the minimum editor and preview widths while dragging', () => {
    const layout = {
      workbenchWidth: 1_100,
      dividerWidth: 12,
      minimumMarkdownWidth: 320,
      minimumPreviewWidth: 430,
    };

    expect(constrainMarkdownPaneWidth({ ...layout, requestedWidth: 120 })).toBe(320);
    expect(constrainMarkdownPaneWidth({ ...layout, requestedWidth: 900 })).toBe(658);
  });

  it('shares a narrow workbench instead of producing a negative pane width', () => {
    expect(
      constrainMarkdownPaneWidth({
        workbenchWidth: 620,
        requestedWidth: 500,
        dividerWidth: 12,
        minimumMarkdownWidth: 320,
        minimumPreviewWidth: 430,
      }),
    ).toBe(304);
  });
});

describe('resizeRightMarkdownPane', () => {
  it('widens the right editor when the divider moves left', () => {
    expect(
      resizeRightMarkdownPane({
        originPaneWidth: 420,
        originPointerX: 760,
        currentPointerX: 700,
      }),
    ).toBe(480);
  });

  it('narrows the right editor when the divider moves right', () => {
    expect(
      resizeRightMarkdownPane({
        originPaneWidth: 420,
        originPointerX: 760,
        currentPointerX: 820,
      }),
    ).toBe(360);
  });
});
