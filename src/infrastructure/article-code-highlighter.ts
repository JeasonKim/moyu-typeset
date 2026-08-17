import highlightJs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import properties from 'highlight.js/lib/languages/properties';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

export interface HighlightArticleCodeInput {
  code: string;
  language?: string;
  tone?: ArticleCodeTone;
}

export type ArticleCodeTone = 'light' | 'dark';

export interface HighlightedArticleCode {
  html: string;
  languageLabel: string;
  highlighted: boolean;
}

interface ArticleCodeLanguage {
  canonicalName: string;
  label: string;
}

const articleCodeLanguages = new Map<string, ArticleCodeLanguage>([
  ['json', { canonicalName: 'json', label: 'JSON' }],
  ['js', { canonicalName: 'javascript', label: 'JavaScript' }],
  ['jsx', { canonicalName: 'javascript', label: 'JSX' }],
  ['javascript', { canonicalName: 'javascript', label: 'JavaScript' }],
  ['ts', { canonicalName: 'typescript', label: 'TypeScript' }],
  ['tsx', { canonicalName: 'typescript', label: 'TSX' }],
  ['typescript', { canonicalName: 'typescript', label: 'TypeScript' }],
  ['java', { canonicalName: 'java', label: 'Java' }],
  ['kt', { canonicalName: 'kotlin', label: 'Kotlin' }],
  ['kotlin', { canonicalName: 'kotlin', label: 'Kotlin' }],
  ['bash', { canonicalName: 'bash', label: 'Bash' }],
  ['sh', { canonicalName: 'bash', label: 'Shell' }],
  ['shell', { canonicalName: 'bash', label: 'Bash' }],
  ['yaml', { canonicalName: 'yaml', label: 'YAML' }],
  ['yml', { canonicalName: 'yaml', label: 'YAML' }],
  ['xml', { canonicalName: 'xml', label: 'XML' }],
  ['html', { canonicalName: 'xml', label: 'HTML' }],
  ['css', { canonicalName: 'css', label: 'CSS' }],
  ['sql', { canonicalName: 'sql', label: 'SQL' }],
  ['md', { canonicalName: 'markdown', label: 'Markdown' }],
  ['markdown', { canonicalName: 'markdown', label: 'Markdown' }],
  ['py', { canonicalName: 'python', label: 'Python' }],
  ['python', { canonicalName: 'python', label: 'Python' }],
  ['go', { canonicalName: 'go', label: 'Go' }],
  ['golang', { canonicalName: 'go', label: 'Go' }],
  ['properties', { canonicalName: 'properties', label: 'Properties' }],
]);

const highlightTokenStyles: Record<ArticleCodeTone, Record<string, string>> = {
  light: {
    'hljs-attr': 'color: #3f6078; font-weight: 600',
    'hljs-property': 'color: #3f6078',
    'hljs-string': 'color: #4f6f52',
    'hljs-number': 'color: #9a5b45',
    'hljs-literal': 'color: #7b5574; font-weight: 600',
    'hljs-keyword': 'color: #6f5d80; font-weight: 600',
    'hljs-title': 'color: #4b6078; font-weight: 600',
    'hljs-built_in': 'color: #846538',
    'hljs-type': 'color: #846538; font-weight: 600',
    'hljs-comment': 'color: #85817a; font-style: italic',
    'hljs-doctag': 'color: #85817a; font-weight: 600',
    'hljs-meta': 'color: #805b70',
    'hljs-tag': 'color: #516b73',
    'hljs-name': 'color: #516b73; font-weight: 600',
    'hljs-attribute': 'color: #7b6148',
    'hljs-variable': 'color: #6f5262',
    'hljs-params': 'color: #4b4f4c',
    'hljs-symbol': 'color: #805b70',
    'hljs-bullet': 'color: #805b70',
    'hljs-section': 'color: #4b6078; font-weight: 700',
    'hljs-selector-tag': 'color: #516b73',
    'hljs-selector-class': 'color: #7b6148',
    'hljs-selector-id': 'color: #6f5262',
    'hljs-addition': 'color: #41634c; background-color: #e7f0e9',
    'hljs-deletion': 'color: #8a4f4b; background-color: #f5e8e6',
    'hljs-emphasis': 'font-style: italic',
    'hljs-strong': 'font-weight: 700',
  },
  dark: {
    'hljs-attr': 'color: #9bcdf5; font-weight: 600',
    'hljs-property': 'color: #9bcdf5',
    'hljs-string': 'color: #add6a7',
    'hljs-number': 'color: #f0b784',
    'hljs-literal': 'color: #d8afe1; font-weight: 600',
    'hljs-keyword': 'color: #c9b1e4; font-weight: 600',
    'hljs-title': 'color: #9fc8eb; font-weight: 600',
    'hljs-built_in': 'color: #e2c18d',
    'hljs-type': 'color: #e2c18d; font-weight: 600',
    'hljs-comment': 'color: #b9b4aa; font-style: italic',
    'hljs-doctag': 'color: #b9b4aa; font-weight: 600',
    'hljs-meta': 'color: #ddb7cf',
    'hljs-tag': 'color: #a1d2da',
    'hljs-name': 'color: #a1d2da; font-weight: 600',
    'hljs-attribute': 'color: #e4bf99',
    'hljs-variable': 'color: #dfb4c6',
    'hljs-params': 'color: #e8e4dc',
    'hljs-symbol': 'color: #ddb7cf',
    'hljs-bullet': 'color: #ddb7cf',
    'hljs-section': 'color: #9fc8eb; font-weight: 700',
    'hljs-selector-tag': 'color: #a1d2da',
    'hljs-selector-class': 'color: #e4bf99',
    'hljs-selector-id': 'color: #dfb4c6',
    'hljs-addition': 'color: #b8deb8; background-color: #294331',
    'hljs-deletion': 'color: #efb4af; background-color: #4a2d2c',
    'hljs-emphasis': 'font-style: italic',
    'hljs-strong': 'font-weight: 700',
  },
};

registerArticleCodeLanguages();

export function highlightArticleCode(input: HighlightArticleCodeInput): HighlightedArticleCode {
  const requestedLanguage = input.language?.trim().split(/\s+/)[0].toLowerCase() ?? '';
  const language = articleCodeLanguages.get(requestedLanguage);
  if (!language) {
    return {
      html: escapeCodeHtml(input.code),
      languageLabel: requestedLanguage.toUpperCase(),
      highlighted: false,
    };
  }

  const highlightedHtml = highlightJs.highlight(input.code, { language: language.canonicalName }).value;
  return {
    html: inlineHighlightTokenStyles(highlightedHtml, input.tone ?? 'light'),
    languageLabel: language.label,
    highlighted: true,
  };
}

function registerArticleCodeLanguages(): void {
  highlightJs.registerLanguage('json', json);
  highlightJs.registerLanguage('javascript', javascript);
  highlightJs.registerLanguage('typescript', typescript);
  highlightJs.registerLanguage('java', java);
  highlightJs.registerLanguage('kotlin', kotlin);
  highlightJs.registerLanguage('bash', bash);
  highlightJs.registerLanguage('yaml', yaml);
  highlightJs.registerLanguage('xml', xml);
  highlightJs.registerLanguage('css', css);
  highlightJs.registerLanguage('sql', sql);
  highlightJs.registerLanguage('markdown', markdown);
  highlightJs.registerLanguage('python', python);
  highlightJs.registerLanguage('go', go);
  highlightJs.registerLanguage('properties', properties);
}

function inlineHighlightTokenStyles(html: string, tone: ArticleCodeTone): string {
  const tokenStyles = highlightTokenStyles[tone];
  return html.replace(/\sclass="([^"]+)"/g, (_, classNames: string) => {
    const style = classNames
      .split(/\s+/)
      .map((className) => tokenStyles[className])
      .filter(Boolean)
      .join('; ');
    return style ? ` style="${style}"` : '';
  });
}

function escapeCodeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
