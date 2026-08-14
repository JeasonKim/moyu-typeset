import type { Mermaid } from 'mermaid';
import type { Viz } from '@viz-js/viz';
import type { ArticleDiagram, ArticleDiagramImageRenderer } from '../domain/article-diagrams';
import { fitWechatDiagramImageSize, type DiagramViewport } from '../domain/wechat-diagram-image';

let mermaidRuntimePromise: Promise<Mermaid> | undefined;
let graphvizRuntimePromise: Promise<Viz> | undefined;
let diagramRenderSequence = 0;

export const browserArticleDiagramRenderer: ArticleDiagramImageRenderer = {
  async renderAsPngDataUrl(diagram: ArticleDiagram): Promise<string> {
    const svg =
      diagram.language === 'mermaid'
        ? await renderMermaidDiagramAsSvg(diagram)
        : await renderGraphvizDiagramAsSvg(diagram);

    return rasterizeDiagramSvgAsPng(svg);
  },
};

async function renderMermaidDiagramAsSvg(diagram: ArticleDiagram): Promise<string> {
  const mermaid = await loadMermaidRuntime();
  diagramRenderSequence += 1;
  const renderId = `moyu-mermaid-${diagram.sequence}-${diagramRenderSequence}`;
  const result = await mermaid.render(renderId, diagram.source);
  return result.svg;
}

async function loadMermaidRuntime(): Promise<Mermaid> {
  if (!mermaidRuntimePromise) {
    mermaidRuntimePromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        htmlLabels: false,
        fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
        themeVariables: {
          background: 'transparent',
          primaryColor: '#f1efea',
          primaryTextColor: '#252422',
          primaryBorderColor: '#77716a',
          secondaryColor: '#e5e2dc',
          secondaryTextColor: '#252422',
          secondaryBorderColor: '#8e8981',
          tertiaryColor: '#faf9f6',
          tertiaryTextColor: '#252422',
          tertiaryBorderColor: '#aaa49b',
          lineColor: '#68645e',
          textColor: '#252422',
          mainBkg: '#f1efea',
          nodeBorder: '#77716a',
          clusterBkg: '#faf9f6',
          clusterBorder: '#aaa49b',
          edgeLabelBackground: '#ffffff',
        },
        flowchart: {
          htmlLabels: false,
        },
      });
      return mermaid;
    });
  }

  return mermaidRuntimePromise;
}

async function renderGraphvizDiagramAsSvg(diagram: ArticleDiagram): Promise<string> {
  const graphviz = await loadGraphvizRuntime();
  return graphviz.renderString(diagram.source, {
    format: 'svg',
    engine: 'dot',
    graphAttributes: {
      bgcolor: 'transparent',
      color: '#68645e',
      fontcolor: '#252422',
      fontname: 'Arial',
      pad: '0.2',
    },
    nodeAttributes: {
      color: '#77716a',
      fillcolor: '#f1efea',
      fontcolor: '#252422',
      fontname: 'Arial',
      style: 'filled,rounded',
    },
    edgeAttributes: {
      color: '#68645e',
      fontcolor: '#514e49',
      fontname: 'Arial',
    },
  });
}

async function loadGraphvizRuntime(): Promise<Viz> {
  if (!graphvizRuntimePromise) {
    graphvizRuntimePromise = import('@viz-js/viz').then(({ instance }) => instance());
  }

  return graphvizRuntimePromise;
}

async function rasterizeDiagramSvgAsPng(svg: string): Promise<string> {
  const parsedSvg = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const svgElement = parsedSvg.documentElement;
  if (svgElement.nodeName.toLowerCase() === 'parsererror') {
    throw new Error('diagram renderer returned invalid SVG');
  }

  sanitizeDiagramSvg(svgElement);
  const viewport = diagramViewportFromSvg(svgElement);
  const canvasSize = fitWechatDiagramImageSize(viewport);
  svgElement.setAttribute('width', String(viewport.width));
  svgElement.setAttribute('height', String(viewport.height));
  svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const safeSvg = new XMLSerializer().serializeToString(svgElement);
  const svgUrl = URL.createObjectURL(new Blob([safeSvg], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = await loadSvgImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('browser canvas 2D context unavailable');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function sanitizeDiagramSvg(svgElement: Element): void {
  svgElement.querySelectorAll('script, foreignObject').forEach((element) => element.remove());
  svgElement.querySelectorAll('*').forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const attributeName = attribute.name.toLowerCase();
      if (attributeName.startsWith('on')) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if ((attributeName === 'href' || attributeName === 'xlink:href') && !attribute.value.startsWith('#')) {
        element.removeAttribute(attribute.name);
      }
    }
  });
}

function diagramViewportFromSvg(svgElement: Element): DiagramViewport {
  const viewBox = svgElement.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }

  return {
    width: numericSvgDimension(svgElement.getAttribute('width')),
    height: numericSvgDimension(svgElement.getAttribute('height')),
  };
}

function numericSvgDimension(value: string | null): number {
  if (!value) {
    return Number.NaN;
  }

  return Number.parseFloat(value);
}

function loadSvgImage(svgUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('browser failed to decode rendered diagram SVG'));
    image.src = svgUrl;
  });
}
