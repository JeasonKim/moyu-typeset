export interface PreviewReadingBlockGeometry {
  anchorId: string;
  topOffset: number;
  height: number;
}

export interface PreviewReadingAnchor {
  anchorId: string;
  topOffset: number;
  progress: number | null;
}

export interface LocateCurrentReadingAnchorInput {
  viewportHeight: number;
  blocks: PreviewReadingBlockGeometry[];
}

export interface CalculateReadingAnchorScrollAdjustmentInput {
  anchor: PreviewReadingAnchor;
  targetBlock: PreviewReadingBlockGeometry | null;
}

export function locateCurrentReadingAnchor(
  input: LocateCurrentReadingAnchorInput,
): PreviewReadingAnchor | null {
  const currentBlock = input.blocks.find(
    (block) => block.height > 0 && block.topOffset + block.height > 0 && block.topOffset < input.viewportHeight,
  );
  if (!currentBlock) {
    return null;
  }

  return {
    anchorId: currentBlock.anchorId,
    topOffset: currentBlock.topOffset,
    progress: currentBlock.topOffset < 0 ? clamp(-currentBlock.topOffset / currentBlock.height, 0, 1) : null,
  };
}

export function calculateReadingAnchorScrollAdjustment(
  input: CalculateReadingAnchorScrollAdjustmentInput,
): number {
  if (!input.targetBlock || input.targetBlock.anchorId !== input.anchor.anchorId) {
    return 0;
  }

  const desiredTopOffset =
    input.anchor.progress === null ? input.anchor.topOffset : -input.targetBlock.height * input.anchor.progress;
  return input.targetBlock.topOffset - desiredTopOffset;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
