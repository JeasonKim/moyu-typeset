import { describe, expect, it } from 'vitest';
import { decideWechatCopyEntry } from './wechat-clipboard-consent';

describe('decideWechatCopyEntry', () => {
  it('requests an explanation before the first clipboard write in a session', () => {
    expect(decideWechatCopyEntry({ acceptedThisSession: false })).toBe('request-consent');
  });

  it('copies directly after consent was accepted in the current session', () => {
    expect(decideWechatCopyEntry({ acceptedThisSession: true })).toBe('copy-article');
  });
});
