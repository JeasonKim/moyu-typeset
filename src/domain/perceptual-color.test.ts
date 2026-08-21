import { describe, expect, it } from 'vitest';
import {
  buildDarkReadingSurface,
  inspectPerceptualColor,
  mapAccentToDarkSurface,
  mixPerceptualColors,
} from './perceptual-color';

describe('dark appearance perceptual color mapping', () => {
  it('raises accent lightness for contrast without washing out its hue and chroma', () => {
    const source = inspectPerceptualColor('#506DFF');
    const mappedHex = mapAccentToDarkSurface({
      color: '#506DFF',
      background: '#111518',
      minimumContrast: 3,
    });
    const mapped = inspectPerceptualColor(mappedHex);

    expect(contrastRatio(mappedHex, '#111518')).toBeGreaterThanOrEqual(3);
    expect(hueDistance(source.hue, mapped.hue)).toBeLessThan(3);
    expect(mapped.chroma).toBeGreaterThanOrEqual(source.chroma * 0.68);
  });

  it('builds a restrained tinted dark surface around the theme accent', () => {
    const surface = buildDarkReadingSurface('#35D6C4');
    const source = inspectPerceptualColor('#35D6C4');
    const background = inspectPerceptualColor(surface.background);

    expect(background.lightness).toBeGreaterThanOrEqual(0.12);
    expect(background.lightness).toBeLessThanOrEqual(0.18);
    expect(background.chroma).toBeGreaterThan(0.01);
    expect(background.chroma).toBeLessThanOrEqual(0.03);
    expect(hueDistance(source.hue, background.hue)).toBeLessThan(3);
    expect(contrastRatio(surface.background, surface.foreground)).toBeGreaterThanOrEqual(7);
  });

  it('mixes chromatic paint into a neutral dark surface without shifting its hue', () => {
    const source = inspectPerceptualColor('#FF8EB2');
    const mixedHex = mixPerceptualColors({
      firstColor: '#FF8EB2',
      secondColor: '#111518',
      secondWeight: 0.7,
    });
    const mixed = inspectPerceptualColor(mixedHex);

    expect(hueDistance(source.hue, mixed.hue)).toBeLessThan(3);
    expect(mixed.chroma).toBeGreaterThan(0.04);
    expect(mixed.lightness).toBeLessThan(source.lightness);
  });
});

function hueDistance(firstHue: number, secondHue: number): number {
  const distance = Math.abs(firstHue - secondHue) % 360;
  return Math.min(distance, 360 - distance);
}

function contrastRatio(firstColor: string, secondColor: string): number {
  const firstLuminance = relativeLuminance(firstColor);
  const secondLuminance = relativeLuminance(secondColor);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function relativeLuminance(color: string): number {
  const channels = color.match(/[\dA-F]{2}/gi)?.map((channel) => Number.parseInt(channel, 16)) ?? [];
  const linearChannels = channels.map((channel) => {
    const normalizedChannel = channel / 255;
    return normalizedChannel <= 0.04045
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  });
  return linearChannels[0] * 0.2126 + linearChannels[1] * 0.7152 + linearChannels[2] * 0.0722;
}
