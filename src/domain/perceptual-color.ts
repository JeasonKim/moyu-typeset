export interface PerceptualColor {
  lightness: number;
  chroma: number;
  hue: number;
}

export interface DarkSurfaceAccentInput {
  color: string;
  background: string;
  minimumContrast: number;
}

export interface DarkReadingSurface {
  background: string;
  foreground: string;
}

export interface PerceptualColorMixInput {
  firstColor: string;
  secondColor: string;
  secondWeight: number;
}

interface SrgbColor {
  red: number;
  green: number;
  blue: number;
}

interface LinearRgbColor {
  red: number;
  green: number;
  blue: number;
}

interface OklabColor {
  lightness: number;
  a: number;
  b: number;
}

export function buildDarkReadingSurface(accentColor: string): DarkReadingSurface {
  const accent = inspectPerceptualColor(accentColor);
  const tintedChroma = accent.chroma < 0.025
    ? 0
    : Math.min(0.03, Math.max(0.012, accent.chroma * 0.14));
  const background = perceptualColorToHex({
    lightness: 0.145,
    chroma: tintedChroma,
    hue: accent.hue,
  });
  const foreground = perceptualColorToHex({
    lightness: 0.94,
    chroma: Math.min(0.012, tintedChroma * 0.4),
    hue: accent.hue,
  });

  return { background, foreground };
}

export function mapAccentToDarkSurface(input: DarkSurfaceAccentInput): string {
  const source = inspectPerceptualColor(input.color);
  const chromaRetention = source.chroma >= 0.1 ? 1 : 0.9;
  const targetChroma = Math.min(0.3, source.chroma * chromaRetention);
  let targetLightness = Math.max(0.62, source.lightness);
  let candidate = perceptualColorToHex({
    lightness: targetLightness,
    chroma: targetChroma,
    hue: source.hue,
  });

  while (contrastRatio(candidate, input.background) < input.minimumContrast && targetLightness < 0.98) {
    targetLightness = Math.min(0.98, targetLightness + 0.01);
    candidate = perceptualColorToHex({
      lightness: targetLightness,
      chroma: targetChroma,
      hue: source.hue,
    });
  }

  return candidate;
}

export function mixPerceptualColors(input: PerceptualColorMixInput): string {
  const first = inspectPerceptualColor(input.firstColor);
  const second = inspectPerceptualColor(input.secondColor);
  const secondWeight = clamp(input.secondWeight, 0, 1);
  const firstWeight = 1 - secondWeight;

  return perceptualColorToHex({
    lightness: first.lightness * firstWeight + second.lightness * secondWeight,
    chroma: first.chroma * firstWeight + second.chroma * secondWeight,
    hue: interpolateHue(first, second, secondWeight),
  });
}

export function inspectPerceptualColor(color: string): PerceptualColor {
  const rgb = parseHexColor(color);
  const lab = linearRgbToOklab({
    red: srgbChannelToLinear(rgb.red),
    green: srgbChannelToLinear(rgb.green),
    blue: srgbChannelToLinear(rgb.blue),
  });
  const chroma = Math.sqrt(lab.a ** 2 + lab.b ** 2);
  const hue = chroma < 0.000001
    ? 0
    : normalizeHue(Math.atan2(lab.b, lab.a) * 180 / Math.PI);

  return {
    lightness: lab.lightness,
    chroma,
    hue,
  };
}

function perceptualColorToHex(color: PerceptualColor): string {
  const mappedColor = fitPerceptualColorIntoSrgb(color);
  const lab = perceptualColorToOklab(mappedColor);
  const linearRgb = oklabToLinearRgb(lab);
  return rgbToHex({
    red: linearChannelToSrgb(linearRgb.red),
    green: linearChannelToSrgb(linearRgb.green),
    blue: linearChannelToSrgb(linearRgb.blue),
  });
}

function fitPerceptualColorIntoSrgb(color: PerceptualColor): PerceptualColor {
  const normalizedColor = {
    lightness: clamp(color.lightness, 0, 1),
    chroma: Math.max(0, color.chroma),
    hue: normalizeHue(color.hue),
  };
  if (isInSrgbGamut(oklabToLinearRgb(perceptualColorToOklab(normalizedColor)))) {
    return normalizedColor;
  }

  let minimumChroma = 0;
  let maximumChroma = normalizedColor.chroma;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const candidateChroma = (minimumChroma + maximumChroma) / 2;
    const candidate = { ...normalizedColor, chroma: candidateChroma };
    if (isInSrgbGamut(oklabToLinearRgb(perceptualColorToOklab(candidate)))) {
      minimumChroma = candidateChroma;
    } else {
      maximumChroma = candidateChroma;
    }
  }

  return { ...normalizedColor, chroma: minimumChroma };
}

function perceptualColorToOklab(color: PerceptualColor): OklabColor {
  const hueRadians = color.hue * Math.PI / 180;
  return {
    lightness: color.lightness,
    a: color.chroma * Math.cos(hueRadians),
    b: color.chroma * Math.sin(hueRadians),
  };
}

function linearRgbToOklab(color: LinearRgbColor): OklabColor {
  const l = Math.cbrt(0.4122214708 * color.red + 0.5363325363 * color.green + 0.0514459929 * color.blue);
  const m = Math.cbrt(0.2119034982 * color.red + 0.6806995451 * color.green + 0.1073969566 * color.blue);
  const s = Math.cbrt(0.0883024619 * color.red + 0.2817188376 * color.green + 0.6299787005 * color.blue);

  return {
    lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinearRgb(color: OklabColor): LinearRgbColor {
  const l = (color.lightness + 0.3963377774 * color.a + 0.2158037573 * color.b) ** 3;
  const m = (color.lightness - 0.1055613458 * color.a - 0.0638541728 * color.b) ** 3;
  const s = (color.lightness - 0.0894841775 * color.a - 1.291485548 * color.b) ** 3;

  return {
    red: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    green: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    blue: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function interpolateHue(first: PerceptualColor, second: PerceptualColor, secondWeight: number): number {
  if (first.chroma < 0.01 || first.chroma <= second.chroma * 0.5) {
    return second.hue;
  }
  if (second.chroma < 0.01 || second.chroma <= first.chroma * 0.5) {
    return first.hue;
  }

  const hueDistance = ((second.hue - first.hue + 540) % 360) - 180;
  const firstHueWeight = first.chroma * (1 - secondWeight);
  const secondHueWeight = second.chroma * secondWeight;
  const chromaWeightedSecondShare = secondHueWeight / (firstHueWeight + secondHueWeight);
  return normalizeHue(first.hue + hueDistance * chromaWeightedSecondShare);
}

function contrastRatio(firstColor: string, secondColor: string): number {
  const firstLuminance = relativeLuminance(parseHexColor(firstColor));
  const secondLuminance = relativeLuminance(parseHexColor(secondColor));
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function relativeLuminance(color: SrgbColor): number {
  return srgbChannelToLinear(color.red) * 0.2126 +
    srgbChannelToLinear(color.green) * 0.7152 +
    srgbChannelToLinear(color.blue) * 0.0722;
}

function parseHexColor(color: string): SrgbColor {
  const match = color.trim().match(/^#([\dA-F]{2})([\dA-F]{2})([\dA-F]{2})$/i);
  if (!match) {
    throw new Error(`[perceptual-color] expected six-digit hex color, received="${color}".`);
  }

  return {
    red: Number.parseInt(match[1], 16) / 255,
    green: Number.parseInt(match[2], 16) / 255,
    blue: Number.parseInt(match[3], 16) / 255,
  };
}

function rgbToHex(color: SrgbColor): string {
  const channels = [color.red, color.green, color.blue]
    .map((channel) => Math.round(clamp(channel, 0, 1) * 255).toString(16).padStart(2, '0'))
    .join('');
  return `#${channels.toUpperCase()}`;
}

function srgbChannelToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function isInSrgbGamut(color: LinearRgbColor): boolean {
  const tolerance = 0.000001;
  return [color.red, color.green, color.blue].every(
    (channel) => channel >= -tolerance && channel <= 1 + tolerance,
  );
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
