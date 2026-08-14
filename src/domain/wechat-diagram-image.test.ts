import { describe, expect, it } from 'vitest';
import { fitWechatDiagramImageSize } from './wechat-diagram-image';

describe('fitWechatDiagramImageSize', () => {
  it('renders ordinary diagrams at double density for sharp WeChat images', () => {
    expect(fitWechatDiagramImageSize({ width: 640, height: 360 })).toEqual({ width: 1280, height: 720 });
  });

  it('keeps oversized diagrams within browser-safe canvas bounds', () => {
    expect(fitWechatDiagramImageSize({ width: 2400, height: 4800 })).toEqual({ width: 1024, height: 2048 });
  });

  it('falls back to a readable landscape size for invalid SVG dimensions', () => {
    expect(fitWechatDiagramImageSize({ width: 0, height: Number.NaN })).toEqual({ width: 1280, height: 720 });
  });
});
