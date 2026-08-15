import { describe, expect, it, vi } from 'vitest';
import { buildTwitterShareUrl, isWechatBrowser, shareMoyuTypesetThroughSystem } from './site-sharing';

describe('shareMoyuTypesetThroughSystem', () => {
  it('guides users to the top-right menu when already inside WeChat', async () => {
    const shareNatively = vi.fn(async () => undefined);
    const copySiteLink = vi.fn(async () => true);

    const result = await shareMoyuTypesetThroughSystem({
      inWechatBrowser: true,
      nativeShareSupported: true,
      shareNatively,
      copySiteLink,
    });

    expect(result).toEqual({ status: 'guided' });
    expect(shareNatively).not.toHaveBeenCalled();
    expect(copySiteLink).not.toHaveBeenCalled();
  });

  it('opens the operating-system share sheet when the browser supports it', async () => {
    const shareNatively = vi.fn(async () => undefined);
    const copySiteLink = vi.fn(async () => true);

    const result = await shareMoyuTypesetThroughSystem({
      inWechatBrowser: false,
      nativeShareSupported: true,
      shareNatively,
      copySiteLink,
    });

    expect(result).toEqual({ status: 'shared', method: 'native' });
    expect(shareNatively).toHaveBeenCalledTimes(1);
    expect(copySiteLink).not.toHaveBeenCalled();
  });

  it('treats dismissing the iOS or Android share sheet as cancellation', async () => {
    const copySiteLink = vi.fn(async () => true);

    const result = await shareMoyuTypesetThroughSystem({
      inWechatBrowser: false,
      nativeShareSupported: true,
      shareNatively: async () => {
        throw new DOMException('share dismissed', 'AbortError');
      },
      copySiteLink,
    });

    expect(result).toEqual({ status: 'cancelled' });
    expect(copySiteLink).not.toHaveBeenCalled();
  });

  it('copies the link when Web Share is unavailable', async () => {
    const result = await shareMoyuTypesetThroughSystem({
      inWechatBrowser: false,
      nativeShareSupported: false,
      shareNatively: async () => undefined,
      copySiteLink: async () => true,
    });

    expect(result).toEqual({ status: 'shared', method: 'clipboard' });
  });

  it('logs an unexpected Web Share failure before falling back to the clipboard', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const copySiteLink = vi.fn(async () => true);

    const result = await shareMoyuTypesetThroughSystem({
      inWechatBrowser: false,
      nativeShareSupported: true,
      shareNatively: async () => {
        throw new Error('share service unavailable');
      },
      copySiteLink,
    });

    expect(result).toEqual({ status: 'shared', method: 'clipboard' });
    expect(copySiteLink).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('share service unavailable'));
    warn.mockRestore();
  });

  it('reports a failed fallback instead of silently claiming the site was shared', async () => {
    const result = await shareMoyuTypesetThroughSystem({
      inWechatBrowser: false,
      nativeShareSupported: false,
      shareNatively: async () => undefined,
      copySiteLink: async () => false,
    });

    expect(result).toEqual({ status: 'failed' });
  });

  it('logs an unexpected clipboard failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await shareMoyuTypesetThroughSystem({
      inWechatBrowser: false,
      nativeShareSupported: false,
      shareNatively: async () => undefined,
      copySiteLink: async () => {
        throw new Error('clipboard unavailable');
      },
    });

    expect(result).toEqual({ status: 'failed' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('clipboard unavailable'));
    warn.mockRestore();
  });
});

describe('mobile sharing helpers', () => {
  it('recognizes the WeChat in-app browser', () => {
    expect(isWechatBrowser('Mozilla/5.0 MicroMessenger/8.0.48')).toBe(true);
    expect(isWechatBrowser('Mozilla/5.0 Mobile Safari/604.1')).toBe(false);
  });

  it('builds an encoded Twitter sharing intent', () => {
    const shareUrl = new URL(
      buildTwitterShareUrl({
        text: '免费开源的公众号 Markdown 排版工具',
        url: 'https://moyu.liaobuqi.ren/',
      }),
    );

    expect(`${shareUrl.origin}${shareUrl.pathname}`).toBe('https://twitter.com/intent/tweet');
    expect(shareUrl.searchParams.get('text')).toBe('免费开源的公众号 Markdown 排版工具');
    expect(shareUrl.searchParams.get('url')).toBe('https://moyu.liaobuqi.ren/');
  });
});
