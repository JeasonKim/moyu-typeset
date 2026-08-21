import { basicSetup } from 'codemirror';
import { redo, undo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, placeholder } from '@codemirror/view';
import {
  applyMarkdownEditingCommand,
  type MarkdownEditingCommand,
  type MarkdownEditingSelection,
} from '../domain/markdown-editing';

export interface MarkdownEditorScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  viewportHeight: number;
}

export interface BrowserMarkdownEditorInput {
  host: HTMLElement;
  markdown: string;
  selection: MarkdownEditingSelection;
  scrollTop: number;
  onMarkdownChange: (markdown: string) => void;
  onScroll: (metrics: MarkdownEditorScrollMetrics) => void;
}

export interface BrowserMarkdownEditor {
  applyEditingCommand(command: MarkdownEditingCommand): void;
  undoEditing(): void;
  redoEditing(): void;
  focus(): void;
  selection(): MarkdownEditingSelection;
  scrollMetrics(): MarkdownEditorScrollMetrics;
  scrollTo(scrollTop: number): void;
  destroy(): void;
}

export function mountBrowserMarkdownEditor(input: BrowserMarkdownEditorInput): BrowserMarkdownEditor {
  const view = new EditorView({
    parent: input.host,
    doc: input.markdown,
    selection: {
      anchor: clamp(input.selection.anchor, 0, input.markdown.length),
      head: clamp(input.selection.head, 0, input.markdown.length),
    },
    extensions: [
      basicSetup,
      markdown(),
      EditorView.lineWrapping,
      placeholder('从这里开始写 Markdown…'),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          input.onMarkdownChange(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': {
          height: '100%',
          color: 'var(--ink-secondary)',
          backgroundColor: 'var(--surface)',
          fontSize: '14px',
        },
        '&.cm-focused': {
          outline: 'none',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.75',
        },
        '.cm-content': {
          minHeight: '100%',
          padding: '18px 0 80px',
          caretColor: 'var(--accent-strong)',
          fontStyle: 'normal',
          fontWeight: '400',
          textDecoration: 'none',
        },
        '.cm-line': {
          padding: '0 20px',
        },
        '.cm-line span': {
          color: 'inherit !important',
          fontFamily: 'inherit !important',
          fontSize: 'inherit !important',
          fontStyle: 'inherit !important',
          fontWeight: 'inherit !important',
          letterSpacing: 'inherit !important',
          textDecoration: 'inherit !important',
          textTransform: 'inherit !important',
        },
        '.cm-gutters': {
          display: 'none',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(95, 111, 101, 0.045)',
        },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: 'rgba(95, 111, 101, 0.16) !important',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: 'var(--accent-strong)',
        },
        '.cm-panels': {
          color: 'var(--ink-secondary)',
          backgroundColor: 'var(--surface-subtle)',
        },
      }),
    ],
  });

  const reportScroll = () => input.onScroll(readScrollMetrics(view));
  view.scrollDOM.addEventListener('scroll', reportScroll, { passive: true });
  window.requestAnimationFrame(() => {
    view.scrollDOM.scrollTop = input.scrollTop;
  });

  return {
    applyEditingCommand(command) {
      const selection = view.state.selection.main;
      const result = applyMarkdownEditingCommand({
        markdown: view.state.doc.toString(),
        selection: { anchor: selection.anchor, head: selection.head },
        command,
      });
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: result.markdown },
        selection: result.selection,
        scrollIntoView: true,
      });
      view.focus();
    },
    undoEditing() {
      undo(view);
      view.focus();
    },
    redoEditing() {
      redo(view);
      view.focus();
    },
    focus() {
      view.focus();
    },
    selection() {
      const selection = view.state.selection.main;
      return { anchor: selection.anchor, head: selection.head };
    },
    scrollMetrics() {
      return readScrollMetrics(view);
    },
    scrollTo(scrollTop) {
      view.scrollDOM.scrollTop = scrollTop;
    },
    destroy() {
      view.scrollDOM.removeEventListener('scroll', reportScroll);
      view.destroy();
    },
  };
}

function readScrollMetrics(view: EditorView): MarkdownEditorScrollMetrics {
  return {
    scrollTop: view.scrollDOM.scrollTop,
    scrollHeight: view.scrollDOM.scrollHeight,
    viewportHeight: view.scrollDOM.clientHeight,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
