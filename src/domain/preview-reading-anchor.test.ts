import { describe, expect, it } from 'vitest';
import {
  calculateUnobstructedReadingViewport,
  calculateReadingAnchorScrollAdjustment,
  locateCurrentReadingAnchor,
} from './preview-reading-anchor';

describe('calculateUnobstructedReadingViewport', () => {
  it('excludes the sticky header and floating theme dock on mobile', () => {
    const viewport = calculateUnobstructedReadingViewport({
      viewportTop: 0,
      viewportBottom: 844,
      topObstructionBottom: 58,
      bottomObstructionTop: 720,
    });

    expect(viewport).toEqual({ top: 58, height: 662 });
  });

  it('ignores obstructions outside the browser viewport', () => {
    const viewport = calculateUnobstructedReadingViewport({
      viewportTop: 0,
      viewportBottom: 844,
      topObstructionBottom: -12,
      bottomObstructionTop: 900,
    });

    expect(viewport).toEqual({ top: 0, height: 844 });
  });

  it('returns an empty viewport when obstructions overlap', () => {
    const viewport = calculateUnobstructedReadingViewport({
      viewportTop: 0,
      viewportBottom: 844,
      topObstructionBottom: 500,
      bottomObstructionTop: 420,
    });

    expect(viewport).toEqual({ top: 500, height: 0 });
  });
});

describe('locateCurrentReadingAnchor', () => {
  it('captures progress inside the first content block crossing the viewport top', () => {
    const anchor = locateCurrentReadingAnchor({
      viewportHeight: 600,
      blocks: [
        { anchorId: 'block-1', topOffset: -500, height: 300 },
        { anchorId: 'block-2', topOffset: -100, height: 400 },
        { anchorId: 'block-3', topOffset: 340, height: 200 },
      ],
    });

    expect(anchor).toEqual({
      anchorId: 'block-2',
      topOffset: -100,
      progress: 0.25,
    });
  });

  it('keeps the visual gap when the next content block starts below the viewport top', () => {
    const anchor = locateCurrentReadingAnchor({
      viewportHeight: 600,
      blocks: [{ anchorId: 'block-4', topOffset: 60, height: 180 }],
    });

    expect(anchor).toEqual({
      anchorId: 'block-4',
      topOffset: 60,
      progress: null,
    });
  });
});

describe('calculateReadingAnchorScrollAdjustment', () => {
  it('restores the same progress when a theme changes the block height', () => {
    const adjustment = calculateReadingAnchorScrollAdjustment({
      anchor: { anchorId: 'block-2', topOffset: -100, progress: 0.25 },
      targetBlock: { anchorId: 'block-2', topOffset: 80, height: 600 },
    });

    expect(adjustment).toBe(230);
  });

  it('returns no adjustment when the target block no longer exists', () => {
    expect(
      calculateReadingAnchorScrollAdjustment({
        anchor: { anchorId: 'block-2', topOffset: -100, progress: 0.25 },
        targetBlock: null,
      }),
    ).toBe(0);
  });
});
