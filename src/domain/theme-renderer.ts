import { marked, type Token } from 'marked';
import type { StyleMap, ThemeComponent, ThemeConfig, ThemeDefinition } from './theme-types';

export interface RenderThemeMarkdownInput {
  markdown: string;
  theme: ThemeDefinition;
}

export interface RenderThemeMarkdownResult {
  html: string;
  usedFallbackConfig: boolean;
}

export function renderThemeMarkdown(input: RenderThemeMarkdownInput): RenderThemeMarkdownResult {
  const { markdown, theme } = input;
  const config = theme.config;

  if (!config) {
    console.warn(
      `[theme-renderer] theme config missing theme="${theme.value || theme.id}". Falling back to section_html preview.`,
    );
    return {
      html: theme.section_html ?? '',
      usedFallbackConfig: true,
    };
  }

  const tokens = marked.lexer(markdown);
  const context: RenderContext = {
    config,
    headingNumbers: new Map(),
  };
  const content = renderBlockTokens(tokens, context);
  const containerStyle = styleToAttribute({
    ...config.base,
    ...config.block?.container,
  });

  return {
    html: `<section style="${containerStyle}">${content}</section>`,
    usedFallbackConfig: false,
  };
}

interface RenderContext {
  config: ThemeConfig;
  headingNumbers: Map<number, number>;
}

function renderBlockTokens(tokens: Token[], context: RenderContext): string {
  return tokens.map((token) => renderBlockToken(token, context)).join('');
}

function renderBlockToken(token: Token, context: RenderContext): string {
  switch (token.type) {
    case 'heading':
      return renderHeading(token as Extract<Token, { type: 'heading' }>, context);
    case 'paragraph':
      return renderParagraph(token as Extract<Token, { type: 'paragraph' }>, context);
    case 'blockquote':
      return renderBlockquote(token as Extract<Token, { type: 'blockquote' }>, context);
    case 'list':
      return renderList(token as Extract<Token, { type: 'list' }>, context);
    case 'space':
      return '';
    case 'hr':
      return `<hr style="${styleToAttribute(context.config.block?.hr)}">`;
    case 'code':
      return renderCodeBlock(token as Extract<Token, { type: 'code' }>, context);
    case 'image':
      return renderImage(token.href, token.text, context);
    case 'html':
      return renderHtmlBlockToken(token, context);
    default:
      return renderUnknownToken(token, context);
  }
}

function renderHeading(token: Extract<Token, { type: 'heading' }>, context: RenderContext): string {
  const key = `h${token.depth}`;
  const inlineHtml = renderInlineTokens(token.tokens ?? [], context);
  const rule = context.config.rules?.[key];
  let headingHtml: string;

  if (rule?.replace_original && rule.decoration) {
    const componentHtml = renderComponent(
      context.config.components?.[rule.decoration],
      {
        content: inlineHtml,
        number: nextHeadingNumber(token.depth, context, rule.auto_number),
      },
      rule.variant,
    );

    if (componentHtml) {
      headingHtml = componentHtml;
      return `${headingHtml}${renderInsertedDecorationAfter(key, context)}`;
    }

    console.warn(
      `[theme-renderer] decoration missing heading="${key}" decoration="${rule.decoration}". Falling back to native heading.`,
    );
  }

  headingHtml = `<${key} style="${styleToAttribute(context.config.block?.[key])}" data-heading="true">${inlineHtml}</${key}>`;
  return `${headingHtml}${renderInsertedDecorationAfter(key, context)}`;
}

function renderParagraph(token: Extract<Token, { type: 'paragraph' }>, context: RenderContext): string {
  if (isSingleImageParagraph(token)) {
    const image = token.tokens[0];
    return renderImage(image.href, image.text, context);
  }

  return `<p style="${styleToAttribute(context.config.block?.p)}">${renderInlineTokens(token.tokens ?? [], context)}</p>`;
}

function renderBlockquote(token: Extract<Token, { type: 'blockquote' }>, context: RenderContext): string {
  const content = renderBlockTokens(token.tokens ?? [], context);
  const rule = context.config.rules?.blockquote;

  if (rule?.replace_original && rule.decoration) {
    const componentHtml = renderComponent(context.config.components?.[rule.decoration], {
      content: renderBlockquoteComponentContent(token.tokens ?? [], context),
    });

    if (componentHtml) {
      return componentHtml;
    }

    console.warn(
      `[theme-renderer] decoration missing blockquote decoration="${rule.decoration}". Falling back to native blockquote.`,
    );
  }

  return `<blockquote style="${styleToAttribute(context.config.block?.blockquote)}">${content}</blockquote>`;
}

function renderList(token: Extract<Token, { type: 'list' }>, context: RenderContext): string {
  const tag = token.ordered ? 'ol' : 'ul';
  const listStyle = styleToAttribute(context.config.block?.[tag]);
  const listItemStyle = styleToAttribute(context.config.inline?.listitem);
  const items = token.items
    .map((item) => `<li style="${listItemStyle}">${renderListItemContent(item.tokens ?? [], context)}</li>`)
    .join('');

  return `<${tag} style="${listStyle}">${items}</${tag}>`;
}

function renderCodeBlock(token: Extract<Token, { type: 'code' }>, context: RenderContext): string {
  const languageClass = token.lang ? ` class="language-${escapeAttribute(token.lang)}"` : '';
  return `<pre style="${styleToAttribute(context.config.block?.code_pre)}"><code${languageClass} style="${styleToAttribute(
    context.config.block?.code,
  )}">${escapeHtml(token.text)}</code></pre>`;
}

function renderHtmlBlockToken(token: Token, context: RenderContext): string {
  const raw = 'raw' in token && typeof token.raw === 'string' ? token.raw : '';
  if (isHtmlComment(raw)) {
    return '';
  }

  return renderUnknownToken(token, context);
}

function renderImage(href: string, text: string, context: RenderContext): string {
  const figureStyle = styleToAttribute(context.config.block?.figure);

  if (isLocalArticleImage(href)) {
    return renderLocalImagePlaceholder(href, text, figureStyle);
  }

  const imageStyle = styleToAttribute(context.config.block?.image);
  const captionStyle = styleToAttribute(context.config.block?.figcaption);
  const alt = escapeAttribute(text);
  const src = escapeAttribute(href);

  return `<figure style="${figureStyle}"><img src="${src}" alt="${alt}" style="${imageStyle}"></figure><figcaption style="${captionStyle}">${escapeHtml(
    text,
  )}</figcaption>`;
}

function renderLocalImagePlaceholder(href: string, text: string, figureStyle: string): string {
  const label = text.trim() || '本地图片';
  const path = escapeHtml(href);

  return `<figure style="${figureStyle}"><section data-local-image-placeholder="true" style="min-height: 180px; padding: 32px; display: flex; align-items: center; justify-content: center; text-align: center; color: #8b8275; background: #faf8f3; border: 1px dashed #d8d1c5; border-radius: 10px"><span style="display: block"><strong style="display: block; margin-bottom: 8px; color: #625b52; font-size: 16px">图片占位</strong><small style="display: block; font-size: 12px; line-height: 1.6">${escapeHtml(
    label,
  )} · ${path}</small></span></section></figure>`;
}

function isLocalArticleImage(href: string): boolean {
  return !/^(https?:|data:|blob:|\/\/)/i.test(href);
}

function renderUnknownToken(token: Token, context: RenderContext): string {
  if ('tokens' in token && Array.isArray(token.tokens)) {
    return renderBlockTokens(token.tokens, context);
  }

  if ('raw' in token && typeof token.raw === 'string') {
    return `<p style="${styleToAttribute(context.config.block?.p)}">${escapeHtml(token.raw)}</p>`;
  }

  return '';
}

function renderInlineTokens(tokens: Token[], context: RenderContext): string {
  return tokens.map((token) => renderInlineToken(token, context)).join('');
}

function renderInlineToken(token: Token, context: RenderContext): string {
  switch (token.type) {
    case 'text':
      return 'tokens' in token && Array.isArray(token.tokens)
        ? renderInlineTokens(token.tokens, context)
        : renderFallbackStrongText(token.text, context);
    case 'strong':
      return `<strong style="${styleToAttribute(context.config.inline?.strong)}">${renderInlineTokens(
        token.tokens ?? [],
        context,
      )}</strong>`;
    case 'em':
      return `<em style="${styleToAttribute(context.config.inline?.em)}">${renderInlineTokens(
        token.tokens ?? [],
        context,
      )}</em>`;
    case 'codespan':
      return `<code style="${styleToAttribute(context.config.inline?.codespan)}">${escapeHtml(token.text)}</code>`;
    case 'link':
      return `<a href="${escapeAttribute(token.href)}" style="${styleToAttribute(
        context.config.inline?.link,
      )}" target="_blank" rel="noreferrer">${renderInlineTokens(token.tokens ?? [], context)}</a>`;
    case 'br':
      return '<br>';
    case 'image':
      return isLocalArticleImage(token.href)
        ? `<span data-local-image-placeholder="true" title="${escapeAttribute(token.href)}">图片占位：${escapeHtml(
            token.text || token.href,
          )}</span>`
        : `<img src="${escapeAttribute(token.href)}" alt="${escapeAttribute(token.text)}" style="${styleToAttribute(
            context.config.block?.image,
          )}">`;
    case 'html':
      return 'raw' in token && typeof token.raw === 'string' && isHtmlComment(token.raw) ? '' : renderUnknownInlineToken(token);
    default:
      return renderUnknownInlineToken(token);
  }
}

function renderUnknownInlineToken(token: Token): string {
  return 'raw' in token && typeof token.raw === 'string' ? escapeHtml(token.raw) : '';
}

function renderListItemContent(tokens: Token[], context: RenderContext): string {
  if (tokens.length === 1 && tokens[0].type === 'text' && 'tokens' in tokens[0] && Array.isArray(tokens[0].tokens)) {
    return renderInlineTokens(tokens[0].tokens, context);
  }

  return renderBlockTokens(tokens, context);
}

function renderFallbackStrongText(text: string, context: RenderContext): string {
  const strongPattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let html = '';

  while ((match = strongPattern.exec(text)) !== null) {
    html += escapeHtml(text.slice(cursor, match.index));
    html += `<strong style="${styleToAttribute(context.config.inline?.strong)}">${escapeHtml(match[1])}</strong>`;
    cursor = match.index + match[0].length;
  }

  html += escapeHtml(text.slice(cursor));
  return html;
}

function renderInsertedDecorationAfter(blockKey: string, context: RenderContext): string {
  const rule = context.config.rules?.section_divider;
  if (!rule?.decoration || !rule.insert_after?.includes(blockKey)) {
    return '';
  }

  const componentHtml = renderComponent(context.config.components?.[rule.decoration], {}, rule.variant);
  if (componentHtml) {
    return componentHtml;
  }

  console.warn(
    `[theme-renderer] inserted decoration missing block="${blockKey}" decoration="${rule.decoration}". Skipped inserted decoration.`,
  );
  return '';
}

function renderComponent(
  component: ThemeComponent | undefined,
  values: Record<string, string>,
  variant?: string,
): string | undefined {
  const template = component?.template ?? (variant ? component?.variants?.[variant]?.template : undefined);
  if (!component?.enabled || !template) {
    return undefined;
  }

  const styleValues = component.style ?? {};
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => {
    const value = values[key] ?? styleValues[key];
    return value == null ? '' : String(value);
  });
}

function nextHeadingNumber(depth: number, context: RenderContext, shouldNumber?: boolean): string {
  if (!shouldNumber) {
    return '';
  }

  const nextValue = (context.headingNumbers.get(depth) ?? 0) + 1;
  context.headingNumbers.set(depth, nextValue);
  return String(nextValue).padStart(2, '0');
}

function isSingleImageParagraph(token: Extract<Token, { type: 'paragraph' }>): token is Extract<
  Token,
  { type: 'paragraph' }
> & { tokens: [Extract<Token, { type: 'image' }>] } {
  return token.tokens?.length === 1 && token.tokens[0].type === 'image';
}

function stripWrappingParagraph(html: string): string {
  const match = html.match(/^<p[^>]*>([\s\S]*)<\/p>$/);
  return match ? match[1] : html;
}

function renderBlockquoteComponentContent(tokens: Token[], context: RenderContext): string {
  const paragraphTokens = tokens.filter((token) => token.type !== 'space');
  if (paragraphTokens.length === 1 && paragraphTokens[0].type === 'paragraph') {
    return stripWrappingParagraph(renderBlockToken(paragraphTokens[0], context));
  }

  return paragraphTokens
    .map((token) => {
      if (token.type !== 'paragraph') {
        return renderBlockToken(token, context);
      }

      return `<p style="margin: 0 0 12px; color: inherit; font-size: inherit; line-height: inherit; font-weight: inherit; letter-spacing: inherit">${renderInlineTokens(
        token.tokens ?? [],
        context,
      )}</p>`;
    })
    .join('');
}

export function styleToAttribute(style?: StyleMap): string {
  if (!style) {
    return '';
  }

  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([property, value]) => `${toCssProperty(property)}: ${escapeAttribute(String(value))}`)
    .join('; ');
}

function toCssProperty(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/_/g, '-');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function isHtmlComment(value: string): boolean {
  return /^<!--[\s\S]*-->$/.test(value.trim());
}
