import { describe, expect, it } from 'vitest';
import {
  calculateReadingAnchorScrollAdjustment,
  locateCurrentReadingAnchor,
} from './preview-reading-anchor';

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
