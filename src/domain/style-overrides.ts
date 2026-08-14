import type { PreviewBoardSettings, ShadowLevel, ThemeStyleOverrides } from './style-editor-types';
import type { StyleMap, ThemeDefinition } from './theme-types';

export function applyThemeStyleOverrides(theme: ThemeDefinition, overrides: ThemeStyleOverrides): ThemeDefinition {
  if (!theme.config) {
    console.warn(
      `[style-overrides] theme config missing theme="${theme.value || theme.id}". Ignored style overrides.`,
    );
    return theme;
  }

  const blockOverrides: Record<string, StyleMap> = {
    ...overrides.text,
    image: overrides.image.image,
    figure: overrides.image.figure,
    figcaption: overrides.image.figcaption,
    container: overrides.background.container,
  };

  const nextTheme: ThemeDefinition = structuredClone(theme);
  const nextConfig = nextTheme.config;
  if (!nextConfig) {
    return theme;
  }

  nextConfig.block = {
    ...nextConfig.block,
    ...mergeStyleRecord(nextConfig.block ?? {}, blockOverrides),
  };
  nextConfig.inline = {
    ...nextConfig.inline,
    strong: {
      ...(nextConfig.inline?.strong ?? {}),
      ...overrides.strong,
    },
  };
  nextConfig.base = {
    ...(nextConfig.base ?? {}),
    ...overrides.background.container,
  };

  for (const [componentName, styleOverride] of Object.entries(overrides.decorations)) {
    if (Object.keys(styleOverride).length === 0) {
      continue;
    }

    const component = nextConfig.components?.[componentName];
    if (!component) {
      console.warn(
        `[style-overrides] decoration override ignored theme="${theme.value || theme.id}" component="${componentName}" reason="component missing".`,
      );
      continue;
    }

    component.style = {
      ...(component.style ?? {}),
      ...styleOverride,
    };
  }

  return nextTheme;
}

export function shadowStyleForLevel(level: ShadowLevel): string {
  switch (level) {
    case 'none':
      return 'none';
    case 'light':
      return '0 8px 20px rgba(15, 23, 42, 0.08)';
    case 'medium':
      return '0 16px 34px rgba(15, 23, 42, 0.16)';
    case 'heavy':
      return '0 24px 52px rgba(15, 23, 42, 0.24)';
  }
}

export function buildPreviewBoardStyle(settings: PreviewBoardSettings): string {
  return styleMapToAttribute(buildPreviewBoardStyleMap(settings));
}

export function buildPreviewBoardStyleMap(settings: PreviewBoardSettings): StyleMap {
  if (!settings.enabled || settings.pattern === 'off') {
    return {};
  }

  const color = hexToRgb(settings.color) ?? '245, 158, 11';
  const alpha = clamp(settings.opacity, 0, 100) / 100;
  const size = Math.max(4, settings.size);

  switch (settings.pattern) {
    case 'fine-grid':
    case 'standard-grid':
    case 'coarse-grid':
      return {
        'background-image': `linear-gradient(rgba(${color}, ${alpha}) 1px, transparent 1px), linear-gradient(90deg, rgba(${color}, ${alpha}) 1px, transparent 1px)`,
        'background-size': `${size}px ${size}px`,
      };
    case 'dot':
      return {
        'background-image': `radial-gradient(circle, rgba(${color}, ${alpha}) 1.6px, transparent 1.8px)`,
        'background-size': `${size}px ${size}px`,
      };
    case 'cross':
      return {
        'background-image': `linear-gradient(45deg, transparent calc(50% - 1px), rgba(${color}, ${alpha}) calc(50% - 1px), rgba(${color}, ${alpha}) calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(-45deg, transparent calc(50% - 1px), rgba(${color}, ${alpha}) calc(50% - 1px), rgba(${color}, ${alpha}) calc(50% + 1px), transparent calc(50% + 1px))`,
        'background-size': `${size}px ${size}px`,
      };
  }
}

function styleMapToAttribute(style: StyleMap): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([property, value]) => `${property}: ${String(value)}`)
    .join('; ');
}

function mergeStyleRecord(base: Record<string, StyleMap>, overrides: Record<string, StyleMap>): Record<string, StyleMap> {
  return Object.entries(overrides).reduce<Record<string, StyleMap>>((mergedStyles, [styleKey, overrideStyle]) => {
    if (Object.keys(overrideStyle).length === 0) {
      return mergedStyles;
    }

    mergedStyles[styleKey] = {
      ...(base[styleKey] ?? {}),
      ...overrideStyle,
    };
    return mergedStyles;
  }, {});
}

function hexToRgb(hex: string): string | undefined {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    console.warn(`[style-overrides] invalid board color color="${hex}". Falling back to orange grid.`);
    return undefined;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
