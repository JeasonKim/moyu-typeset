import { marked, type Token, type Tokens } from 'marked';
import {
  highlightArticleCode,
  type ArticleCodeTone,
} from '../infrastructure/article-code-highlighter';
import { omitRedundantHeadingSequence } from './heading-sequence';
import type { StyleMap, ThemeComponent, ThemeConfig, ThemeDefinition } from './theme-types';

export interface RenderThemeMarkdownInput {
  markdown: string;
  theme: ThemeDefinition;
  readingAnchors?: boolean;
  target?: ThemeRenderTarget;
}

export type ThemeRenderTarget = 'preview' | 'wechat-clipboard';

export interface RenderThemeMarkdownResult {
  html: string;
  usedFallbackConfig: boolean;
}

type TableCellTag = 'th' | 'td';

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

  const tokens = marked.lexer(markdown, { gfm: true, breaks: false });
  const context: RenderContext = {
    config,
    headingNumbers: new Map(),
    target: input.target ?? 'preview',
  };
  const content = renderBlockTokens(tokens, context, input.readingAnchors);
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
  target: ThemeRenderTarget;
}

function renderBlockTokens(tokens: Token[], context: RenderContext, readingAnchors = false): string {
  let readingAnchorIndex = 0;
  return tokens
    .map((token) => {
      const html = renderBlockToken(token, context);
      if (!readingAnchors || !html) {
        return html;
      }

      readingAnchorIndex += 1;
      return attachReadingAnchor(html, `block-${readingAnchorIndex}`);
    })
    .join('');
}

function attachReadingAnchor(html: string, anchorId: string): string {
  return html.replace(
    /<([a-zA-Z][\w:-]*)(?=[\s>])/,
    `<$1 data-reading-anchor="${escapeAttribute(anchorId)}"`,
  );
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
    case 'table':
      return renderTable(token as Tokens.Table, context);
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
  const rule = context.config.rules?.[key];

  // 主题已经生成章节编号时，移除文案自带的编号，避免预览和公众号草稿出现双序号。
  const headingTokens = rule?.auto_number
    ? omitHeadingSequenceFromInlineTokens(token.tokens ?? [])
    : (token.tokens ?? []);
  const inlineHtml = renderInlineTokens(headingTokens, context);
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

interface InlineTokenSequenceOmission {
  tokens: Token[];
  remainingCharacters: number;
}

interface InlineTokenOmission {
  token: Token | null;
  remainingCharacters: number;
}

function omitHeadingSequenceFromInlineTokens(tokens: Token[]): Token[] {
  const visibleLabel = inlineTokenPlainText(tokens);
  const omission = omitRedundantHeadingSequence(visibleLabel);
  if (omission.omittedCharacterCount === 0) {
    return tokens;
  }

  return omitLeadingInlineCharacters(tokens, omission.omittedCharacterCount).tokens;
}

function inlineTokenPlainText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if ('tokens' in token && Array.isArray(token.tokens)) {
        return inlineTokenPlainText(token.tokens);
      }
      if ('text' in token && typeof token.text === 'string') {
        return token.text;
      }
      return '';
    })
    .join('');
}

function omitLeadingInlineCharacters(tokens: Token[], characterCount: number): InlineTokenSequenceOmission {
  let remainingCharacters = characterCount;
  const remainingTokens: Token[] = [];

  for (const token of tokens) {
    const omission = omitLeadingCharactersFromToken(token, remainingCharacters);
    remainingCharacters = omission.remainingCharacters;
    if (omission.token) {
      remainingTokens.push(omission.token);
    }
  }

  return { tokens: remainingTokens, remainingCharacters };
}

function omitLeadingCharactersFromToken(token: Token, characterCount: number): InlineTokenOmission {
  if (characterCount === 0) {
    return { token, remainingCharacters: 0 };
  }

  if ('tokens' in token && Array.isArray(token.tokens)) {
    const nestedOmission = omitLeadingInlineCharacters(token.tokens, characterCount);
    return {
      token: nestedOmission.tokens.length > 0 ? ({ ...token, tokens: nestedOmission.tokens } as Token) : null,
      remainingCharacters: nestedOmission.remainingCharacters,
    };
  }

  if (!('text' in token) || typeof token.text !== 'string') {
    return { token, remainingCharacters: characterCount };
  }

  if (token.text.length <= characterCount) {
    return { token: null, remainingCharacters: characterCount - token.text.length };
  }

  return {
    token: { ...token, text: token.text.slice(characterCount) } as Token,
    remainingCharacters: 0,
  };
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

  if (context.target === 'wechat-clipboard') {
    return renderWechatCompatibleList(token, context, tag);
  }

  const items = token.items
    .map((item) => {
      const taskMarker = item.task ? renderTaskMarker(item.checked === true) : '';
      const contentTokens = item.task ? item.tokens.filter((itemToken) => itemToken.type !== 'checkbox') : item.tokens;
      return `<li style="${listItemStyle}">${taskMarker}${renderListItemContent(contentTokens ?? [], context)}</li>`;
    })
    .join('');

  return `<${tag} style="${listStyle}">${items}</${tag}>`;
}

function renderWechatCompatibleList(
  token: Extract<Token, { type: 'list' }>,
  context: RenderContext,
  tag: 'ol' | 'ul',
): string {
  const configuredListStyle = context.config.block?.[tag];
  const copiedListStyle = styleToAttribute({
    ...configuredListStyle,
    display: 'block',
  });
  const copiedItemStyle = styleToAttribute({
    ...context.config.inline?.listitem,
    display: 'block',
  });
  const items = token.items
    .map((item, index) => {
      const taskMarker = item.task ? renderTaskMarker(item.checked === true) : '';
      const contentTokens = item.task ? item.tokens.filter((itemToken) => itemToken.type !== 'checkbox') : item.tokens;
      const listMarker = item.task ? '' : renderWechatListMarker(token.ordered, index, configuredListStyle);
      return `<section data-wechat-list-item="true" style="${copiedItemStyle}">${listMarker}${taskMarker}${renderListItemContent(
        contentTokens ?? [],
        context,
      )}</section>`;
    })
    .join('');

  return `<section data-wechat-list="${token.ordered ? 'ordered' : 'unordered'}" style="${copiedListStyle}">${items}</section>`;
}

function renderWechatListMarker(ordered: boolean, index: number, style?: StyleMap): string {
  const configuredMarker = style?.['list-style'] ?? style?.list_style;
  if (configuredMarker === 'none') {
    return '';
  }

  const marker = ordered ? `${index + 1}.` : '•';
  return `<span style="margin-right: 0.45em" data-wechat-list-marker="true">${marker}</span>`;
}

function renderTaskMarker(checked: boolean): string {
  const taskState = checked ? 'checked' : 'unchecked';
  const marker = checked ? '✓' : '○';
  return `<span data-task-state="${taskState}" aria-hidden="true" style="display: inline-block; width: 1.1em; margin-right: 0.45em; color: inherit; font-family: Arial, sans-serif; font-size: 0.92em; font-weight: 600; line-height: 1; text-align: center; vertical-align: 0.02em">${marker}</span>`;
}

function renderTable(token: Tokens.Table, context: RenderContext): string {
  const minimumTableWidth = `${token.header.length * 144}px`;
  const header = token.header
    .map((cell) => renderTableCell('th', cell, context))
    .join('');
  const rows = token.rows
    .map(
      (row) =>
        `<tr style="${styleToAttribute(context.config.block?.tr)}">${row
          .map((cell) => renderTableCell('td', cell, context))
          .join('')}</tr>`,
    )
    .join('');
  const tableStyle = styleToAttribute({
    width: '100%',
    ...context.config.block?.table,
    'min-width': minimumTableWidth,
    'table-layout': 'auto',
  });

  return `<section data-table-scroll="true" style="display: block; width: 100%; max-width: 100%; margin: 1.25em 0; overflow-x: auto; -webkit-overflow-scrolling: touch"><table style="${tableStyle}"><thead style="${styleToAttribute(context.config.block?.thead)}"><tr style="${styleToAttribute(
    context.config.block?.tr,
  )}">${header}</tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderTableCell(tag: TableCellTag, cell: Tokens.TableCell, context: RenderContext): string {
  const alignmentStyle = cell.align ? { 'text-align': cell.align } : {};
  const cellStyle = styleToAttribute({
    ...context.config.block?.[tag],
    ...alignmentStyle,
    'white-space': 'nowrap',
  });
  return `<${tag} style="${cellStyle}">${renderInlineTokens(cell.tokens ?? [], context)}</${tag}>`;
}

function renderCodeBlock(token: Extract<Token, { type: 'code' }>, context: RenderContext): string {
  const codeTone = resolveCodeHighlightTone(context.config.block?.code_pre);
  const highlightedCode = highlightArticleCode({ code: token.text, language: token.lang, tone: codeTone });
  const languageLabelColor = codeTone === 'dark' ? '#c8c3b9' : '#6f7471';
  const languageLabelStyle = styleToAttribute({
    display: 'block',
    margin: '0 0 0.75em',
    color: languageLabelColor,
    'font-family': 'ui-sans-serif, sans-serif',
    'font-size': '11px',
    'font-weight': '600',
    'letter-spacing': '0.08em',
    'line-height': '1',
    ...context.config.block?.code_label,
  });
  const languageLabel = highlightedCode.languageLabel
    ? `<span aria-hidden="true" style="${languageLabelStyle}">${escapeHtml(
        highlightedCode.languageLabel,
      )}</span>`
    : '';
  const preStyle = styleToAttribute({
    margin: '1.25em 0',
    padding: '1em 1.1em',
    color: '#343835',
    'background-color': '#f4f3ef',
    border: '1px solid #deddd7',
    'border-radius': '8px',
    'overflow-x': 'auto',
    ...context.config.block?.code_pre,
  });
  const codeStyle = styleToAttribute({
    display: 'block',
    color: 'inherit',
    'white-space': 'pre-wrap',
    'word-break': 'normal',
    ...context.config.block?.code,
  });

  return `<pre data-code-language="${escapeAttribute(highlightedCode.languageLabel)}" data-code-tone="${codeTone}" style="${preStyle}">${languageLabel}<code style="${codeStyle}">${highlightedCode.html}</code></pre>`;
}

function resolveCodeHighlightTone(codeBlockStyle: StyleMap | undefined): ArticleCodeTone {
  const foregroundColor = codeBlockStyle?.color;
  if (typeof foregroundColor !== 'string') {
    return 'light';
  }

  const normalizedColor = foregroundColor.trim();
  const match = normalizedColor.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) {
    return 'light';
  }

  const hex = match[1].length === 3 ? [...match[1]].map((channel) => channel.repeat(2)).join('') : match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const perceivedBrightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return perceivedBrightness >= 170 ? 'dark' : 'light';
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
      return renderStrongInline(renderInlineTokens(token.tokens ?? [], context), context);
    case 'em':
      return `<em style="${styleToAttribute(context.config.inline?.em)}">${renderInlineTokens(
        token.tokens ?? [],
        context,
      )}</em>`;
    case 'codespan':
      return `<code style="${styleToAttribute(context.config.inline?.codespan)}">${escapeHtml(token.text)}</code>`;
    case 'del':
      return `<del style="${styleToAttribute({
        'text-decoration': 'line-through',
        ...context.config.inline?.del,
      })}">${renderInlineTokens(token.tokens ?? [], context)}</del>`;
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
    html += renderStrongInline(escapeHtml(match[1]), context);
    cursor = match.index + match[0].length;
  }

  html += escapeHtml(text.slice(cursor));
  return html;
}

function renderStrongInline(content: string, context: RenderContext): string {
  return `<strong data-inline-strong="true" style="${styleToAttribute({
    ...context.config.inline?.strong,
    display: 'inline',
  })}">${content}</strong>`;
}

function renderInsertedDecorationAfter(blockKey: string, context: RenderContext): string {
  const rule = context.config.rules?.section_divider;
  if (!rule?.decoration || !rule.insert_after?.includes(blockKey)) {
    return '';
  }

  const dividerComponent = context.config.components?.[rule.decoration];
  if (dividerComponent?.enabled === false) {
    return '';
  }

  const componentHtml = renderComponent(dividerComponent, {}, rule.variant);
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
