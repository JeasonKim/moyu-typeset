export type ArticleDiagramLanguage = 'mermaid' | 'graphviz';

export interface ArticleDiagram {
  sequence: number;
  language: ArticleDiagramLanguage;
  source: string;
}

export interface ArticleDiagramImageRenderer {
  renderAsPngDataUrl(diagram: ArticleDiagram): Promise<string>;
}

export interface EmbedArticleDiagramsInput {
  markdown: string;
  renderer: ArticleDiagramImageRenderer;
}

export interface ArticleDiagramEmbeddingResult {
  markdown: string;
  diagramCount: number;
  embeddedDiagramCount: number;
  failedDiagramCount: number;
}

interface ArticleDiagramFence extends ArticleDiagram {
  start: number;
  end: number;
  raw: string;
}

interface MarkdownLine {
  start: number;
  end: number;
  contentEnd: number;
  content: string;
}

const pngDataUrlPattern = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const openingFencePattern = /^( {0,3})(`{3,}|~{3,})[ \t]*([A-Za-z][\w-]*)(?:[ \t]+[^\r\n]*)?[ \t]*$/;
const closingFencePattern = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

export async function embedArticleDiagramsAsImages(
  input: EmbedArticleDiagramsInput,
): Promise<ArticleDiagramEmbeddingResult> {
  const diagrams = collectArticleDiagramFences(input.markdown);
  if (diagrams.length === 0) {
    return summarizeDiagramEmbedding(input.markdown, 0, 0);
  }

  let cursor = 0;
  let convertedMarkdown = '';
  let embeddedDiagramCount = 0;
  let failedDiagramCount = 0;

  // 按原文顺序逐个渲染，避免 Mermaid 的临时 DOM 与 Graphviz WASM 初始化互相竞争。
  for (const diagram of diagrams) {
    convertedMarkdown += input.markdown.slice(cursor, diagram.start);

    try {
      const articleDiagram: ArticleDiagram = {
        sequence: diagram.sequence,
        language: diagram.language,
        source: diagram.source,
      };
      const imageDataUrl = await input.renderer.renderAsPngDataUrl(articleDiagram);
      if (!pngDataUrlPattern.test(imageDataUrl)) {
        throw new Error('invalid PNG data URL');
      }

      convertedMarkdown += `![${diagramLabel(diagram.language)}](${imageDataUrl})`;
      embeddedDiagramCount += 1;
    } catch (error) {
      failedDiagramCount += 1;
      convertedMarkdown += diagram.raw;
      console.warn(
        `[article-diagrams] diagram render failed sequence=${diagram.sequence} language="${diagram.language}" reason="${String(
          error,
        )}". Keeping source code block.`,
      );
    }

    cursor = diagram.end;
  }

  convertedMarkdown += input.markdown.slice(cursor);
  return summarizeDiagramEmbedding(convertedMarkdown, diagrams.length, embeddedDiagramCount, failedDiagramCount);
}

function collectArticleDiagramFences(markdown: string): ArticleDiagramFence[] {
  const diagrams: ArticleDiagramFence[] = [];
  const lines = splitMarkdownLines(markdown);
  let sequence = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const openingLine = lines[lineIndex];
    const openingMatch = openingLine.content.match(openingFencePattern);
    if (!openingMatch) {
      continue;
    }

    const openingFence = openingMatch[2];
    const closingLineIndex = findClosingFenceLine(lines, lineIndex + 1, openingFence);
    if (closingLineIndex === -1) {
      continue;
    }

    const closingLine = lines[closingLineIndex];
    const language = normalizeDiagramLanguage(openingMatch[3]);
    lineIndex = closingLineIndex;
    if (!language) {
      continue;
    }

    sequence += 1;
    diagrams.push({
      sequence,
      language,
      source: markdown.slice(openingLine.end, closingLine.start).replace(/\r?\n$/, '').replace(/\r\n?/g, '\n'),
      start: openingLine.start,
      end: closingLine.contentEnd,
      raw: markdown.slice(openingLine.start, closingLine.contentEnd),
    });
  }

  return diagrams;
}

function splitMarkdownLines(markdown: string): MarkdownLine[] {
  const lines: MarkdownLine[] = [];

  for (const match of markdown.matchAll(/[^\n]*(?:\n|$)/g)) {
    if (!match[0] || match.index === undefined) {
      continue;
    }

    const contentWithPossibleCarriageReturn = match[0].endsWith('\n') ? match[0].slice(0, -1) : match[0];
    const content = contentWithPossibleCarriageReturn.endsWith('\r')
      ? contentWithPossibleCarriageReturn.slice(0, -1)
      : contentWithPossibleCarriageReturn;
    lines.push({
      start: match.index,
      end: match.index + match[0].length,
      contentEnd: match.index + content.length,
      content,
    });
  }

  return lines;
}

function findClosingFenceLine(lines: MarkdownLine[], startIndex: number, openingFence: string): number {
  for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
    const closingMatch = lines[lineIndex].content.match(closingFencePattern);
    if (!closingMatch) {
      continue;
    }

    const closingFence = closingMatch[2];
    if (closingFence[0] === openingFence[0] && closingFence.length >= openingFence.length) {
      return lineIndex;
    }
  }

  return -1;
}

function normalizeDiagramLanguage(language: string): ArticleDiagramLanguage | undefined {
  switch (language.toLowerCase()) {
    case 'mermaid':
      return 'mermaid';
    case 'dot':
    case 'graphviz':
      return 'graphviz';
    default:
      return undefined;
  }
}

function diagramLabel(language: ArticleDiagramLanguage): string {
  return language === 'mermaid' ? 'Mermaid 图表' : 'Graphviz 图表';
}

function summarizeDiagramEmbedding(
  markdown: string,
  diagramCount: number,
  embeddedDiagramCount: number,
  failedDiagramCount = 0,
): ArticleDiagramEmbeddingResult {
  return {
    markdown,
    diagramCount,
    embeddedDiagramCount,
    failedDiagramCount,
  };
}
