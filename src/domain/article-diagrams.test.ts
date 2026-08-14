import { describe, expect, it, vi } from 'vitest';
import {
  embedArticleDiagramsAsImages,
  type ArticleDiagram,
  type ArticleDiagramImageRenderer,
} from './article-diagrams';

function diagramRendererReturningImages(): ArticleDiagramImageRenderer {
  return {
    renderAsPngDataUrl: vi.fn(async (diagram: ArticleDiagram) => {
      return diagram.language === 'mermaid'
        ? 'data:image/png;base64,bWVybWFpZA=='
        : 'data:image/png;base64,Z3JhcGh2aXo=';
    }),
  };
}

describe('embedArticleDiagramsAsImages', () => {
  it('turns Mermaid and Graphviz fences into base64 PNG images while preserving normal code', async () => {
    const renderer = diagramRendererReturningImages();
    const markdown = [
      '# 架构说明',
      '',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      '',
      '```dot',
      'digraph G { A -> B }',
      '```',
      '',
      '```ts',
      'const ready = true;',
      '```',
    ].join('\n');

    const result = await embedArticleDiagramsAsImages({ markdown, renderer });

    expect(result).toEqual({
      markdown: expect.any(String),
      diagramCount: 2,
      embeddedDiagramCount: 2,
      failedDiagramCount: 0,
    });
    expect(result.markdown).toContain('![Mermaid 图表](data:image/png;base64,bWVybWFpZA==)');
    expect(result.markdown).toContain('![Graphviz 图表](data:image/png;base64,Z3JhcGh2aXo=)');
    expect(result.markdown).toContain('```ts\nconst ready = true;\n```');
    expect(renderer.renderAsPngDataUrl).toHaveBeenCalledWith({
      sequence: 1,
      language: 'mermaid',
      source: 'flowchart LR\n  A --> B',
    });
    expect(renderer.renderAsPngDataUrl).toHaveBeenCalledWith({
      sequence: 2,
      language: 'graphviz',
      source: 'digraph G { A -> B }',
    });
  });

  it('accepts graphviz aliases, case differences and tilde fences', async () => {
    const renderer = diagramRendererReturningImages();
    const markdown = ['  ~~~GraphViz', 'digraph G { Start -> Finish }', ' ~~~~'].join('\n');

    const result = await embedArticleDiagramsAsImages({ markdown, renderer });

    expect(result.embeddedDiagramCount).toBe(1);
    expect(result.markdown).toBe('![Graphviz 图表](data:image/png;base64,Z3JhcGh2aXo=)');
  });

  it('keeps a failed diagram as source code and logs why it fell back', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const renderer: ArticleDiagramImageRenderer = {
      renderAsPngDataUrl: vi.fn(async () => {
        throw new Error('syntax error');
      }),
    };
    const markdown = ['```mermaid', 'flowchart ???', '```'].join('\n');

    const result = await embedArticleDiagramsAsImages({ markdown, renderer });

    expect(result).toEqual({
      markdown,
      diagramCount: 1,
      embeddedDiagramCount: 0,
      failedDiagramCount: 1,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('diagram render failed sequence=1 language="mermaid" reason="Error: syntax error"'),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Keeping source code block'));
    warn.mockRestore();
  });

  it('rejects a renderer result that is not a PNG data URL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const renderer: ArticleDiagramImageRenderer = {
      renderAsPngDataUrl: vi.fn(async () => '<svg></svg>'),
    };
    const markdown = ['```mermaid', 'flowchart LR', '```'].join('\n');

    const result = await embedArticleDiagramsAsImages({ markdown, renderer });

    expect(result.markdown).toBe(markdown);
    expect(result.failedDiagramCount).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid PNG data URL'));
    warn.mockRestore();
  });

  it('leaves Markdown without supported diagram fences untouched', async () => {
    const renderer = diagramRendererReturningImages();
    const markdown = '# 普通文章\n\n```plantuml\nAlice -> Bob\n```';

    const result = await embedArticleDiagramsAsImages({ markdown, renderer });

    expect(result).toEqual({
      markdown,
      diagramCount: 0,
      embeddedDiagramCount: 0,
      failedDiagramCount: 0,
    });
    expect(renderer.renderAsPngDataUrl).not.toHaveBeenCalled();
  });
});
