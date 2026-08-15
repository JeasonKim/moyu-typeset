export interface WechatClipboardCapabilities {
  canCreateClipboardItem: boolean;
  canWriteRichContent: boolean;
}

export interface WechatArticleCopyOptions {
  canCopyAsynchronously: boolean;
  copySynchronously(): boolean;
  copyAsynchronously(): Promise<void>;
}

export type WechatArticleCopyResult =
  | { status: 'copied'; method: 'synchronous' | 'asynchronous' }
  | { status: 'failed'; reason: 'unavailable' }
  | { status: 'failed'; reason: 'rejected'; error: unknown };

export function canCopyWechatRichText(capabilities: WechatClipboardCapabilities): boolean {
  return capabilities.canCreateClipboardItem && capabilities.canWriteRichContent;
}

export async function copyWechatArticle(options: WechatArticleCopyOptions): Promise<WechatArticleCopyResult> {
  // HTTPS 环境优先使用浏览器富文本剪贴板，让权限请求与用户刚确认的说明保持一致。
  if (options.canCopyAsynchronously) {
    try {
      await options.copyAsynchronously();
      return { status: 'copied', method: 'asynchronous' };
    } catch (error) {
      if (isClipboardPermissionRejection(error)) {
        return { status: 'failed', reason: 'rejected', error };
      }
      if (options.copySynchronously()) {
        return { status: 'copied', method: 'synchronous' };
      }
      return { status: 'failed', reason: 'rejected', error };
    }
  }

  return options.copySynchronously()
    ? { status: 'copied', method: 'synchronous' }
    : { status: 'failed', reason: 'unavailable' };
}

function isClipboardPermissionRejection(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotAllowedError';
}

export function articlePlainTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|blockquote|h[1-6]|li|figcaption)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
