import { describe, expect, it } from 'vitest';
import { articlePlainTextFromHtml, canCopyWechatRichText } from './wechat-clipboard';

describe('canCopyWechatRichText', () => {
  it('requires both ClipboardItem and rich clipboard write support', () => {
    expect(canCopyWechatRichText({ canCreateClipboardItem: true, canWriteRichContent: true })).toBe(true);
    expect(canCopyWechatRichText({ canCreateClipboardItem: false, canWriteRichContent: true })).toBe(false);
    expect(canCopyWechatRichText({ canCreateClipboardItem: true, canWriteRichContent: false })).toBe(false);
  });
});

describe('articlePlainTextFromHtml', () => {
  it('turns article html into readable fallback text', () => {
    const html = `
      <section>
        <style>.hidden { color: red; }</style>
        <h1>标题&nbsp;&amp;&nbsp;副标题</h1>
        <p>第一段<br>换行</p>
        <script>alert("ignored")</script>
      </section>
    `;

    expect(articlePlainTextFromHtml(html)).toBe('标题 & 副标题\n\n第一段\n换行');
  });
});
