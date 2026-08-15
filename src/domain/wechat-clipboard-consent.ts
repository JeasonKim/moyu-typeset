export interface WechatClipboardConsentState {
  acceptedThisSession: boolean;
}

export type WechatCopyEntryDecision = 'request-consent' | 'copy-article';

export function decideWechatCopyEntry(state: WechatClipboardConsentState): WechatCopyEntryDecision {
  return state.acceptedThisSession ? 'copy-article' : 'request-consent';
}
