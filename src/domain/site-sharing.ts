export interface SystemSiteShareOptions {
  inWechatBrowser: boolean;
  nativeShareSupported: boolean;
  shareNatively(): Promise<void>;
  copySiteLink(): Promise<boolean>;
}

export interface TwitterShareContent {
  text: string;
  url: string;
}

export type SystemSiteShareResult =
  | { status: 'guided' }
  | { status: 'shared'; method: 'native' | 'clipboard' }
  | { status: 'cancelled' }
  | { status: 'failed' };

export async function shareMoyuTypesetThroughSystem(
  options: SystemSiteShareOptions,
): Promise<SystemSiteShareResult> {
  // 微信内置浏览器由右上角菜单负责转发，网页无法可靠代替用户触发这个入口。
  if (options.inWechatBrowser) {
    return { status: 'guided' };
  }

  // Web Share API 在 iOS 和 Android 上分别交给系统分享面板处理，不绑定具体目标应用。
  if (options.nativeShareSupported) {
    try {
      await options.shareNatively();
      return { status: 'shared', method: 'native' };
    } catch (error) {
      if (isShareCancellation(error)) {
        return { status: 'cancelled' };
      }
      console.warn(`[site-sharing] system share failed reason="${String(error)}". Falling back to clipboard.`);
    }
  }

  // 系统分享不可用或异常时保留可完成的下一步，并让调用方明确告知用户已经复制链接。
  try {
    return (await options.copySiteLink())
      ? { status: 'shared', method: 'clipboard' }
      : { status: 'failed' };
  } catch (error) {
    console.warn(`[site-sharing] share-link clipboard fallback failed reason="${String(error)}".`);
    return { status: 'failed' };
  }
}

export function isWechatBrowser(userAgent: string): boolean {
  return /MicroMessenger/i.test(userAgent);
}

export function buildTwitterShareUrl(content: TwitterShareContent): string {
  const shareUrl = new URL('https://twitter.com/intent/tweet');
  shareUrl.searchParams.set('text', content.text);
  shareUrl.searchParams.set('url', content.url);
  return shareUrl.toString();
}

function isShareCancellation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
