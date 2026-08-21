export type MarkdownEditingCommand =
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'bold'
  | 'italic'
  | 'inline-code'
  | 'blockquote'
  | 'unordered-list'
  | 'ordered-list'
  | 'task-list'
  | 'code-block'
  | 'table'
  | 'link'
  | 'horizontal-rule';

export interface MarkdownEditingSelection {
  anchor: number;
  head: number;
}

export interface MarkdownEditingCommandInput {
  markdown: string;
  selection: MarkdownEditingSelection;
  command: MarkdownEditingCommand;
}

export interface MarkdownEditingCommandResult {
  markdown: string;
  selection: MarkdownEditingSelection;
}

interface InlineMarkdownDecoration {
  prefix: string;
  suffix: string;
  placeholder: string;
}

interface MarkdownLineRange {
  start: number;
  end: number;
  text: string;
}

const inlineDecorations: Partial<Record<MarkdownEditingCommand, InlineMarkdownDecoration>> = {
  bold: { prefix: '**', suffix: '**', placeholder: '加粗文字' },
  italic: { prefix: '*', suffix: '*', placeholder: '斜体文字' },
  'inline-code': { prefix: '`', suffix: '`', placeholder: '代码' },
  link: { prefix: '[', suffix: '](https://)', placeholder: '链接文字' },
  'code-block': { prefix: '```\n', suffix: '\n```', placeholder: '代码内容' },
};

const linePrefixes: Partial<Record<MarkdownEditingCommand, string>> = {
  blockquote: '> ',
  'unordered-list': '- ',
  'ordered-list': '1. ',
  'task-list': '- [ ] ',
};

export function applyMarkdownEditingCommand(input: MarkdownEditingCommandInput): MarkdownEditingCommandResult {
  const selection = orderedSelection(input.selection);
  const decoration = inlineDecorations[input.command];
  if (decoration) {
    return decorateMarkdownSelection(input.markdown, selection, decoration);
  }

  if (input.command.startsWith('heading-')) {
    const level = Number.parseInt(input.command.slice('heading-'.length), 10);
    return assignHeadingLevel(input.markdown, selection, level);
  }

  const linePrefix = linePrefixes[input.command];
  if (linePrefix) {
    return prefixMarkdownLines(input.markdown, selection, linePrefix);
  }

  if (input.command === 'table') {
    return insertStandaloneMarkdownBlock(
      input.markdown,
      selection,
      '| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |',
      2,
      4,
    );
  }

  return insertStandaloneMarkdownBlock(input.markdown, selection, '---', 0, 0);
}

function orderedSelection(selection: MarkdownEditingSelection): MarkdownEditingSelection {
  return selection.anchor <= selection.head
    ? selection
    : { anchor: selection.head, head: selection.anchor };
}

function decorateMarkdownSelection(
  markdown: string,
  selection: MarkdownEditingSelection,
  decoration: InlineMarkdownDecoration,
): MarkdownEditingCommandResult {
  const selectedText = markdown.slice(selection.anchor, selection.head) || decoration.placeholder;
  const decoratedText = `${decoration.prefix}${selectedText}${decoration.suffix}`;
  const contentStart = selection.anchor + decoration.prefix.length;

  return {
    markdown: replaceMarkdownRange(markdown, selection.anchor, selection.head, decoratedText),
    selection: {
      anchor: contentStart,
      head: contentStart + selectedText.length,
    },
  };
}

function assignHeadingLevel(
  markdown: string,
  selection: MarkdownEditingSelection,
  level: number,
): MarkdownEditingCommandResult {
  const lineRange = selectedMarkdownLines(markdown, selection);
  const headingPrefix = `${'#'.repeat(level)} `;
  const headedLines = transformMarkdownLines(
    lineRange.text,
    (line) => `${headingPrefix}${line.replace(/^#{1,6}\s+/, '')}`,
  );

  return replaceSelectedMarkdownLines(markdown, lineRange, headedLines);
}

function prefixMarkdownLines(
  markdown: string,
  selection: MarkdownEditingSelection,
  prefix: string,
): MarkdownEditingCommandResult {
  const lineRange = selectedMarkdownLines(markdown, selection);
  const prefixedLines = transformMarkdownLines(lineRange.text, (line) => `${prefix}${line}`);

  return replaceSelectedMarkdownLines(markdown, lineRange, prefixedLines);
}

function selectedMarkdownLines(markdown: string, selection: MarkdownEditingSelection): MarkdownLineRange {
  const start = markdown.lastIndexOf('\n', Math.max(0, selection.anchor - 1)) + 1;
  const selectionEndsAtLineStart = selection.head > selection.anchor && markdown[selection.head - 1] === '\n';
  const followingLineBreak = markdown.indexOf('\n', selection.head);
  const end = selectionEndsAtLineStart
    ? selection.head
    : followingLineBreak === -1
      ? markdown.length
      : followingLineBreak;

  return { start, end, text: markdown.slice(start, end) };
}

function replaceSelectedMarkdownLines(
  markdown: string,
  lineRange: MarkdownLineRange,
  replacement: string,
): MarkdownEditingCommandResult {
  return {
    markdown: replaceMarkdownRange(markdown, lineRange.start, lineRange.end, replacement),
    selection: {
      anchor: lineRange.start,
      head: lineRange.start + replacement.length,
    },
  };
}

function insertStandaloneMarkdownBlock(
  markdown: string,
  selection: MarkdownEditingSelection,
  block: string,
  selectedTextOffset: number,
  selectedTextLength: number,
): MarkdownEditingCommandResult {
  const prefix = markdown.slice(0, selection.anchor);
  const suffix = markdown.slice(selection.head);
  const leadingSpacing = prefix.length > 0 && !prefix.endsWith('\n\n') ? (prefix.endsWith('\n') ? '\n' : '\n\n') : '';
  const trailingSpacing = suffix.length > 0 && !suffix.startsWith('\n\n') ? (suffix.startsWith('\n') ? '\n' : '\n\n') : '\n\n';
  const insertion = `${leadingSpacing}${block}${trailingSpacing}`;
  const blockStart = selection.anchor + leadingSpacing.length;

  return {
    markdown: `${prefix}${insertion}${suffix}`,
    selection: {
      anchor: blockStart + selectedTextOffset,
      head: blockStart + selectedTextOffset + selectedTextLength,
    },
  };
}

function replaceMarkdownRange(markdown: string, start: number, end: number, replacement: string): string {
  return `${markdown.slice(0, start)}${replacement}${markdown.slice(end)}`;
}

function transformMarkdownLines(markdown: string, transformLine: (line: string) => string): string {
  const trailingLineBreak = markdown.endsWith('\n');
  const lines = (trailingLineBreak ? markdown.slice(0, -1) : markdown).split('\n');
  const transformedLines = lines.map(transformLine).join('\n');
  return trailingLineBreak ? `${transformedLines}\n` : transformedLines;
}
