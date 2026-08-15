import { describe, expect, it, vi } from 'vitest';
import {
  articlePlainTextFromHtml,
  canCopyWechatRichText,
  copyWechatArticle,
} from './wechat-clipboard';

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

describe('copyWechatArticle', () => {
  it('uses the permission-aware rich clipboard when the browser supports it', async () => {
    const copyAsynchronously = vi.fn(async () => undefined);
    const copySynchronously = vi.fn(() => true);

    const result = await copyWechatArticle({
      copySynchronously,
      canCopyAsynchronously: true,
      copyAsynchronously,
    });

    expect(result).toEqual({ status: 'copied', method: 'asynchronous' });
    expect(copyAsynchronously).toHaveBeenCalledTimes(1);
    expect(copySynchronously).not.toHaveBeenCalled();
  });

  it('uses synchronous rich copy when the modern clipboard is unavailable', async () => {
    const copyAsynchronously = vi.fn(async () => undefined);

    const result = await copyWechatArticle({
      copySynchronously: () => true,
      canCopyAsynchronously: false,
      copyAsynchronously,
    });

    expect(result).toEqual({ status: 'copied', method: 'synchronous' });
    expect(copyAsynchronously).not.toHaveBeenCalled();
  });

  it('respects a browser permission rejection instead of bypassing it', async () => {
    const clipboardError = new DOMException('clipboard denied', 'NotAllowedError');
    const copySynchronously = vi.fn(() => true);

    const result = await copyWechatArticle({
      copySynchronously,
      canCopyAsynchronously: true,
      copyAsynchronously: async () => {
        throw clipboardError;
      },
    });

    expect(result).toEqual({ status: 'failed', reason: 'rejected', error: clipboardError });
    expect(copySynchronously).not.toHaveBeenCalled();
  });

  it('uses the compatible rich copy when the modern API fails for a non-permission reason', async () => {
    const copySynchronously = vi.fn(() => true);

    const result = await copyWechatArticle({
      copySynchronously,
      canCopyAsynchronously: true,
      copyAsynchronously: async () => {
        throw new Error('clipboard format unavailable');
      },
    });

    expect(result).toEqual({ status: 'copied', method: 'synchronous' });
    expect(copySynchronously).toHaveBeenCalledTimes(1);
  });

  it('reports why copying failed instead of silently claiming success', async () => {
    const clipboardError = new Error('clipboard denied');

    await expect(
      copyWechatArticle({
        copySynchronously: () => false,
        canCopyAsynchronously: true,
        copyAsynchronously: async () => {
          throw clipboardError;
        },
      }),
    ).resolves.toEqual({ status: 'failed', reason: 'rejected', error: clipboardError });

    await expect(
      copyWechatArticle({
        copySynchronously: () => false,
        canCopyAsynchronously: false,
        copyAsynchronously: async () => undefined,
      }),
    ).resolves.toEqual({ status: 'failed', reason: 'unavailable' });
  });
});
