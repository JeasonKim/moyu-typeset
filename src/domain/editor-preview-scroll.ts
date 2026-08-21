export interface SynchronizedScrollPositionInput {
  sourceScrollTop: number;
  sourceScrollHeight: number;
  sourceViewportHeight: number;
  targetScrollHeight: number;
  targetViewportHeight: number;
}

export function mapSynchronizedScrollPosition(input: SynchronizedScrollPositionInput): number {
  const sourceRange = Math.max(0, input.sourceScrollHeight - input.sourceViewportHeight);
  const targetRange = Math.max(0, input.targetScrollHeight - input.targetViewportHeight);
  if (sourceRange === 0 || targetRange === 0) {
    return 0;
  }

  const readingProgress = clamp(input.sourceScrollTop / sourceRange, 0, 1);
  return readingProgress * targetRange;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

