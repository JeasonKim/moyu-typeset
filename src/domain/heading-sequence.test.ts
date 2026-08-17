import { describe, expect, it } from 'vitest';
import { omitRedundantHeadingSequence } from './heading-sequence';

describe('omitRedundantHeadingSequence', () => {
  it.each([
    ['一、先打开 Markdown', '先打开 Markdown'],
    ['二. 主题决定视觉语气', '主题决定视觉语气'],
    ['（三）内容块', '内容块'],
    ['(4) 样式面板', '样式面板'],
    ['5）预览与发布', '预览与发布'],
    ['第六章 开始使用', '开始使用'],
    ['第 7 节：复制文章', '复制文章'],
    ['2.1 文字样式', '文字样式'],
    ['2.1.3、表格样式', '表格样式'],
    ['IV. Publish', 'Publish'],
  ])('omits a chapter sequence from %s', (label, expected) => {
    const result = omitRedundantHeadingSequence(label);

    expect(result.label).toBe(expected);
    expect(result.omittedCharacterCount).toBeGreaterThan(0);
  });

  it.each(['2026 年趋势', '3D 打印', '1.5 倍增长', '100% 增长', '一体化设计', '第一性原理', '一、'])(
    'keeps semantic leading text in %s',
    (label) => {
      expect(omitRedundantHeadingSequence(label)).toEqual({
        label,
        omittedPrefix: '',
        omittedCharacterCount: 0,
      });
    },
  );
});
