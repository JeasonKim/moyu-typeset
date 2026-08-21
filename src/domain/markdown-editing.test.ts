import { describe, expect, it } from 'vitest';
import { applyMarkdownEditingCommand } from './markdown-editing';

describe('applyMarkdownEditingCommand', () => {
  it('wraps the selected text and keeps the selection on the business content', () => {
    expect(
      applyMarkdownEditingCommand({
        markdown: '这是重点内容',
        selection: { anchor: 2, head: 6 },
        command: 'bold',
      }),
    ).toEqual({
      markdown: '这是**重点内容**',
      selection: { anchor: 4, head: 8 },
    });
  });

  it('inserts an editable placeholder when the selection is empty', () => {
    expect(
      applyMarkdownEditingCommand({
        markdown: '',
        selection: { anchor: 0, head: 0 },
        command: 'link',
      }),
    ).toEqual({
      markdown: '[链接文字](https://)',
      selection: { anchor: 1, head: 5 },
    });
  });

  it('changes the complete selected lines into the requested heading level', () => {
    expect(
      applyMarkdownEditingCommand({
        markdown: '开头\n## 原标题\n下一行\n结尾',
        selection: { anchor: 3, head: 14 },
        command: 'heading-3',
      }),
    ).toEqual({
      markdown: '开头\n### 原标题\n### 下一行\n结尾',
      selection: { anchor: 3, head: 19 },
    });
  });

  it('prefixes every selected line for quote and list commands', () => {
    const quoted = applyMarkdownEditingCommand({
      markdown: '第一行\n第二行',
      selection: { anchor: 0, head: 7 },
      command: 'blockquote',
    });
    const listed = applyMarkdownEditingCommand({
      markdown: quoted.markdown,
      selection: quoted.selection,
      command: 'task-list',
    });

    expect(quoted.markdown).toBe('> 第一行\n> 第二行');
    expect(listed.markdown).toBe('- [ ] > 第一行\n- [ ] > 第二行');
  });

  it('inserts standalone blocks with surrounding blank lines', () => {
    expect(
      applyMarkdownEditingCommand({
        markdown: '正文',
        selection: { anchor: 2, head: 2 },
        command: 'horizontal-rule',
      }).markdown,
    ).toBe('正文\n\n---\n\n');
  });
});

