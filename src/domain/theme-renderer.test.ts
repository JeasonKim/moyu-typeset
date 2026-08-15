import { describe, expect, it, vi } from 'vitest';
import { renderThemeMarkdown, styleToAttribute } from './theme-renderer';
import type { ThemeDefinition } from './theme-types';

const decoratedTheme: ThemeDefinition = {
  id: 'decorated',
  label: '装饰主题',
  value: 'decorated',
  section_html: '<section>sample</section>',
  config: {
    base: { color: '#111111' },
    block: {
      container: { background_color: '#ffffff' },
      p: { margin: '10px 0' },
      h1: { color: '#222222' },
      ul: { padding_left: '0' },
      figure: { margin: '1rem 0' },
      image: { max_width: '100%' },
      figcaption: { display: 'none' },
    },
    inline: {
      strong: { font_weight: '700' },
      listitem: { list_style: 'none' },
    },
    rules: {
      h1: {
        decoration: 'hero_title',
        replace_original: true,
        auto_number: true,
      },
      section_divider: {
        decoration: 'divider',
        insert_after: ['h1'],
        variant: 'signal',
      },
    },
    components: {
      hero_title: {
        enabled: true,
        style: { title_color: '#ffffff' },
        template: '<section data-title="{{number}}" style="color: {{title_color}}">{{content}}</section>',
      },
      divider: {
        enabled: true,
        style: {
          accent_color: '#ff5a3d',
        },
        variants: {
          signal: {
            template: '<hr style="border-color: {{accent_color}}">',
          },
        },
      },
    },
  },
};

describe('renderThemeMarkdown', () => {
  it('renders markdown with theme styles and replacement components', () => {
    const result = renderThemeMarkdown({
      markdown: '# 标题\n\n这是 **重点**。\n\n- 第一项',
      theme: decoratedTheme,
    });

    expect(result.usedFallbackConfig).toBe(false);
    expect(result.html).toContain('color: #111111');
    expect(result.html).toContain('background-color: #ffffff');
    expect(result.html).toContain('data-title="01"');
    expect(result.html).toContain('<hr style="border-color: #ff5a3d">');
    expect(result.html).toContain('data-inline-strong="true"');
    expect(result.html).toContain('>重点</strong>');
    expect(result.html).toContain('<ul style="padding-left: 0">');
  });

  it('uses section_html and logs when theme config is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = renderThemeMarkdown({
      markdown: '# 标题',
      theme: {
        id: 'legacy',
        label: '旧主题',
        value: 'legacy',
        section_html: '<section>legacy</section>',
      },
    });

    expect(result.usedFallbackConfig).toBe(true);
    expect(result.html).toBe('<section>legacy</section>');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('theme="legacy"'));

    warn.mockRestore();
  });

  it('keeps Chinese bold markers styled when a parser leaves them as text', () => {
    const result = renderThemeMarkdown({
      markdown: '**星链已成天花板。**目前\n\n- **载荷革命**：成本下降',
      theme: decoratedTheme,
    });

    expect(result.html).toContain('>星链已成天花板。</strong>目前');
    expect(result.html).toContain('>载荷革命</strong>：成本下降</li>');
  });

  it('uses semantic emphasis so WeChat keeps the label and following punctuation inline', () => {
    const result = renderThemeMarkdown({
      markdown: '- **全部模板**：浏览完整的排版样式',
      theme: decoratedTheme,
    });

    expect(result.html).toContain('data-inline-strong="true"');
    expect(result.html).toContain('>全部模板</strong>：浏览完整的排版样式');
  });

  it('serializes copied lists as stable blocks instead of native lists that WeChat rewrites', () => {
    const result = renderThemeMarkdown({
      markdown: '- **全部模板**：浏览完整的排版样式',
      theme: decoratedTheme,
      target: 'wechat-clipboard',
    });

    expect(result.html).not.toContain('<ul');
    expect(result.html).not.toContain('<li');
    expect(result.html).toContain('data-wechat-list="unordered"');
    expect(result.html).toContain('data-wechat-list-item="true"');
    expect(result.html).toContain('>全部模板</strong>：浏览完整的排版样式');
  });

  it('keeps visible ordered-list numbering in the copied block structure', () => {
    const numberedTheme: ThemeDefinition = structuredClone(decoratedTheme);
    numberedTheme.config!.block!.ol = { 'list-style': 'decimal' };

    const result = renderThemeMarkdown({
      markdown: '1. 打开 Markdown\n2. 选择主题',
      theme: numberedTheme,
      target: 'wechat-clipboard',
    });

    expect(result.html).toContain('data-wechat-list-marker="true">1.</span>打开 Markdown');
    expect(result.html).toContain('data-wechat-list-marker="true">2.</span>选择主题');
  });

  it('renders GFM tables with header and body cells', () => {
    const result = renderThemeMarkdown({
      markdown: '| 模板 | 用途 |\n| :--- | ---: |\n| **全部模板** | 浏览完整样式 |\n| 日常长文 | 通知与随笔 |',
      theme: decoratedTheme,
    });

    expect(result.html).toContain('<table');
    expect(result.html).toContain('<thead');
    expect(result.html).toContain('<tbody>');
    expect(result.html).toContain('<th');
    expect(result.html).toContain('<td');
    expect(result.html).toContain('>全部模板</strong>');
  });

  it('renders task lists and strikethrough without interactive controls', () => {
    const result = renderThemeMarkdown({
      markdown: '- [x] 已完成\n- [ ] 待处理\n\n~~旧结论~~',
      theme: decoratedTheme,
    });

    expect(result.html).toContain('data-task-state="checked"');
    expect(result.html).toContain('data-task-state="unchecked"');
    expect(result.html).not.toContain('<input');
    expect(result.html).toContain('<del');
  });

  it('renders supported fenced code with a language label and highlighted tokens', () => {
    const result = renderThemeMarkdown({
      markdown: '```json\n{"name":"墨鱼","ready":true}\n```',
      theme: decoratedTheme,
    });

    expect(result.html).toContain('data-code-language="JSON"');
    expect(result.html).toContain('<span');
    expect(result.html).toContain('&quot;name&quot;');
  });

  it('adds stable reading anchors only to preview output when requested', () => {
    const markdown = '# 标题\n\n第一段。\n\n- 列表项';
    const preview = renderThemeMarkdown({ markdown, theme: decoratedTheme, readingAnchors: true });
    const copiedArticle = renderThemeMarkdown({ markdown, theme: decoratedTheme });

    expect(preview.html.match(/data-reading-anchor="block-\d+"/g)).toHaveLength(3);
    expect(preview.html).toContain('data-reading-anchor="block-1"');
    expect(preview.html).toContain('data-reading-anchor="block-2"');
    expect(preview.html).toContain('data-reading-anchor="block-3"');
    expect(copiedArticle.html).not.toContain('data-reading-anchor');
  });

  it('drops image metadata comments from rendered article content', () => {
    const result = renderThemeMarkdown({
      markdown:
        '![循环关系](data:image/png;base64,test)\n\n<!-- 图片备注：测试配图，只用于内部预览链路。 -->\n\n正文继续。',
      theme: decoratedTheme,
    });

    expect(result.html).toContain('<img src="data:image/png;base64,test"');
    expect(result.html).toContain('正文继续。');
    expect(result.html).not.toContain('图片备注');
    expect(result.html).not.toContain('&lt;!--');
  });

  it('renders local article images as explanatory placeholders', () => {
    const result = renderThemeMarkdown({
      markdown: '![产品封面](./images/cover.png)',
      theme: decoratedTheme,
    });

    expect(result.html).toContain('data-local-image-placeholder="true"');
    expect(result.html).toContain('图片占位');
    expect(result.html).toContain('./images/cover.png');
    expect(result.html).not.toContain('<img src="./images/cover.png"');
  });

  it('keeps remote and base64 article images renderable', () => {
    const result = renderThemeMarkdown({
      markdown: '![远程图片](https://example.com/cover.png)\n\n![内嵌图片](data:image/png;base64,test)',
      theme: decoratedTheme,
    });

    expect(result.html).toContain('<img src="https://example.com/cover.png"');
    expect(result.html).toContain('<img src="data:image/png;base64,test"');
    expect(result.html).not.toContain('data-local-image-placeholder="true"');
  });

  it('keeps decorated multi-paragraph blockquotes readable by inheriting quote text color', () => {
    const result = renderThemeMarkdown({
      markdown: '> 第一段引用\n>\n> 第二段引用',
      theme: {
        ...decoratedTheme,
        config: {
          ...decoratedTheme.config,
          block: {
            ...decoratedTheme.config?.block,
            p: { color: '#111111' },
          },
          rules: {
            blockquote: {
              decoration: 'quote',
              replace_original: true,
            },
          },
          components: {
            quote: {
              enabled: true,
              style: { text_color: '#ffffff' },
              template: '<section style="color: {{text_color}}">{{content}}</section>',
            },
          },
        },
      },
    });

    expect(result.html).toContain('style="color: #ffffff"');
    expect(result.html).toContain('color: inherit');
    expect(result.html).not.toContain('<p style="color: #111111">');
  });
});

describe('styleToAttribute', () => {
  it('normalizes css property names and drops empty fallback values', () => {
    expect(
      styleToAttribute({
        background_color: '#fff',
        fontSize: '16px',
        color: undefined,
        hidden: false,
      }),
    ).toBe('background-color: #fff; font-size: 16px');
  });
});
