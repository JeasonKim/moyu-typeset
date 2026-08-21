export interface MarkdownPaneWidthConstraint {
  workbenchWidth: number;
  requestedWidth: number;
  dividerWidth: number;
  minimumMarkdownWidth: number;
  minimumPreviewWidth: number;
}

export interface RightMarkdownPaneResize {
  originPaneWidth: number;
  originPointerX: number;
  currentPointerX: number;
}

export function constrainMarkdownPaneWidth(input: MarkdownPaneWidthConstraint): number {
  const availableWidth = Math.max(0, input.workbenchWidth - input.dividerWidth);
  const requestedMinimums = input.minimumMarkdownWidth + input.minimumPreviewWidth;
  if (availableWidth < requestedMinimums) {
    return Math.round(availableWidth / 2);
  }

  const maximumMarkdownWidth = availableWidth - input.minimumPreviewWidth;
  return clamp(input.requestedWidth, input.minimumMarkdownWidth, maximumMarkdownWidth);
}

export function resizeRightMarkdownPane(input: RightMarkdownPaneResize): number {
  return input.originPaneWidth - (input.currentPointerX - input.originPointerX);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
