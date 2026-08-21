import { describe, expect, it } from 'vitest';
import { mapSynchronizedScrollPosition } from './editor-preview-scroll';

describe('mapSynchronizedScrollPosition', () => {
  it('maps the source reading progress onto the target scroll range', () => {
    expect(
      mapSynchronizedScrollPosition({
        sourceScrollTop: 300,
        sourceScrollHeight: 1_000,
        sourceViewportHeight: 400,
        targetScrollHeight: 1_600,
        targetViewportHeight: 400,
      }),
    ).toBe(600);
  });

  it('clamps overscroll to the target boundaries', () => {
    const input = {
      sourceScrollHeight: 1_000,
      sourceViewportHeight: 400,
      targetScrollHeight: 1_600,
      targetViewportHeight: 400,
    };

    expect(mapSynchronizedScrollPosition({ ...input, sourceScrollTop: -20 })).toBe(0);
    expect(mapSynchronizedScrollPosition({ ...input, sourceScrollTop: 900 })).toBe(1_200);
  });

  it('keeps the target at the top when either surface cannot scroll', () => {
    expect(
      mapSynchronizedScrollPosition({
        sourceScrollTop: 10,
        sourceScrollHeight: 400,
        sourceViewportHeight: 400,
        targetScrollHeight: 1_600,
        targetViewportHeight: 400,
      }),
    ).toBe(0);
  });
});

