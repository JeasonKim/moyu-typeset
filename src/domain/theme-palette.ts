import type { StyleMap, ThemeAppearance, ThemeDefinition } from './theme-types';

export interface ThemePaletteSurface {
  background: string;
  foreground: string;
}

const defaultPaletteSurface: ThemePaletteSurface = {
  background: '#FFFFFF',
  foreground: '#242625',
};

export function resolveThemePaletteSurface(theme: ThemeDefinition): ThemePaletteSurface {
  const renderedContainerStyle: StyleMap = {
    ...theme.config?.base,
    ...theme.config?.block?.container,
  };
  const background = renderedContainerStyle['background-color'] ?? renderedContainerStyle.background;
  const foreground = renderedContainerStyle.color;

  if (isHexColor(background) && isHexColor(foreground)) {
    return { background, foreground };
  }

  console.warn(
    `[theme-preview] invalid palette surface theme="${theme.value || theme.id}" background="${String(background)}" foreground="${String(foreground)}". Falling back to background="${defaultPaletteSurface.background}" foreground="${defaultPaletteSurface.foreground}".`,
  );
  return defaultPaletteSurface;
}

export function inferThemeAppearance(background: string): ThemeAppearance {
  return relativeLuminance(background) < 0.18 ? 'dark' : 'light';
}

export function contrastRatio(firstColor: string, secondColor: string): number {
  const firstLuminance = relativeLuminance(firstColor);
  const secondLuminance = relativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: string): number {
  const channels = hexChannels(color).map((channel) => {
    const normalizedChannel = channel / 255;
    return normalizedChannel <= 0.04045
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function hexChannels(color: string): [number, number, number] {
  if (!isHexColor(color)) {
    throw new Error(`[theme-preview] invalid hex color="${color}".`);
  }

  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}
