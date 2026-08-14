export interface DiagramViewport {
  width: number;
  height: number;
}

export interface WechatDiagramImageSize {
  width: number;
  height: number;
}

const fallbackViewport: DiagramViewport = { width: 640, height: 360 };
const diagramPixelRatio = 2;
const maximumCanvasWidth = 2_400;
const maximumCanvasHeight = 2_048;

export function fitWechatDiagramImageSize(viewport: DiagramViewport): WechatDiagramImageSize {
  const readableViewport = isReadableViewport(viewport) ? viewport : fallbackViewport;
  const densityWidth = readableViewport.width * diagramPixelRatio;
  const densityHeight = readableViewport.height * diagramPixelRatio;
  const scale = Math.min(1, maximumCanvasWidth / densityWidth, maximumCanvasHeight / densityHeight);

  return {
    width: Math.max(1, Math.round(densityWidth * scale)),
    height: Math.max(1, Math.round(densityHeight * scale)),
  };
}

function isReadableViewport(viewport: DiagramViewport): boolean {
  return Number.isFinite(viewport.width) && viewport.width > 0 && Number.isFinite(viewport.height) && viewport.height > 0;
}
