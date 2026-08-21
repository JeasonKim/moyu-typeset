import { describe, expect, it, vi } from 'vitest';
import themesDataset from '../data/themes.json';
import {
  applyThemeAppearance,
  resolveThemeAppearancePreview,
  selectThemeAppearance,
} from './theme-appearance';
import { inspectPerceptualColor } from './perceptual-color';
import { contrastRatio, inferThemeAppearance, resolveThemePaletteSurface } from './theme-palette';
import type { StyleMap, ThemeDefinition, ThemesDataset } from './theme-types';

const inlineColorTokenPattern = /#[\da-f]{6}\b|#[\da-f]{3}\b|rgba?\([^)]*\)|(?<![\w-])(?:white|black)(?![\w-])/gi;

function normalizeStyleColors(style: StyleMap): StyleMap {
  return Object.fromEntries(
    Object.entries(style).map(([property, value]) => [
      property,
      typeof value === 'string' ? value.replace(inlineColorTokenPattern, '<color>') : value,
    ]),
  );
}

function normalizeThemeGeometry(theme: ThemeDefinition): string {
  return JSON.stringify(normalizeGeometryValue({
    section_html: theme.section_html,
    config: theme.config,
  }));
}

function normalizeGeometryValue(value: unknown, property = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeGeometryValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, nestedValue]) => {
        const normalizedProperty = key.toLowerCase().replaceAll('_', '-');
        if (normalizedProperty === 'color' || normalizedProperty === 'background-color') {
          return [];
        }
        return [[key, normalizeGeometryValue(nestedValue, normalizedProperty)]];
      }),
    );
  }
  if (typeof value !== 'string') {
    return value;
  }
  if (property.endsWith('-color') || property.endsWith('-text')) {
    return '<color>';
  }
  return value.replace(inlineColorTokenPattern, '<color>');
}

function compositeRgbaOverHex(rgba: string, background: string): string {
  const foregroundChannels = rgba.match(/[\d.]+/g)?.map(Number) ?? [];
  const backgroundChannels = background.match(/[\dA-F]{2}/gi)?.map((channel) =>
    Number.parseInt(channel, 16)
  ) ?? [];
  const alpha = foregroundChannels[3] ?? 1;

  return `#${[0, 1, 2]
    .map((index) => Math.round(
      foregroundChannels[index] * alpha + backgroundChannels[index] * (1 - alpha),
    ).toString(16).padStart(2, '0'))
    .join('')}`;
}

const lightTheme: ThemeDefinition = {
  id: 'paper-note',
  value: 'paper-note',
  label: '纸页手记',
  palette: {
    colorFamilies: ['warm'],
    appearance: 'light',
    primary: '#A16207',
    secondary: '#D6C4A8',
  },
  config: {
    base: {
      color: '#312C26',
      'background-color': '#FFFCF5',
      'font-family': 'serif',
    },
    block: {
      container: {
        color: '#312C26',
        'background-color': '#FFFCF5',
        padding: '20px',
      },
      blockquote: {
        color: '#665847',
        background: '#F8EEDB',
        'border-left': '3px solid #A16207',
      },
    },
    rules: {
      h2: { decoration: 'section-heading', wrap_content: true },
    },
    components: {
      'section-heading': {
        template: '<section style="background:#F8EEDB;color:#312C26">{{content}}</section>',
        style: { color: '#312C26', background: '#F8EEDB' },
      },
    },
  },
};

const semanticComponentTheme: ThemeDefinition = {
  ...lightTheme,
  id: 'semantic-component',
  value: 'semantic-component',
  config: {
    ...lightTheme.config,
    block: {
      ...lightTheme.config?.block,
      code_pre: {
        background: 'transparent',
      },
    },
    components: {
      'section-heading': {
        template:
          '<section style="background:{{bg_color}};color:{{title_color}}"><span style="background:{{chip_bg}};color:{{chip_text}}">{{content}}</span><section style="background:{{accent_yellow}}"><strong style="color:{{accent_title_color}}">{{content}}</strong></section></section>',
        style: {
          bg_color: '#FFFFFF',
          title_color: '#111111',
          chip_bg: '#F8EEDB',
          chip_text: '#312C26',
          accent_yellow: '#FFD85A',
          accent_title_color: '#111111',
          line_color: '#D6C4A8',
        },
      },
    },
  },
};

const nativeDarkTheme: ThemeDefinition = {
  ...semanticComponentTheme,
  id: 'native-dark',
  value: 'native-dark',
  palette: {
    ...semanticComponentTheme.palette,
    appearance: 'dark',
  },
  config: {
    ...semanticComponentTheme.config,
    base: { color: '#F4F4F4', 'background-color': '#111111' },
    block: {
      ...semanticComponentTheme.config?.block,
      container: { color: '#F4F4F4', 'background-color': '#111111' },
    },
  },
};

const shapeAndDividerTheme: ThemeDefinition = {
  ...nativeDarkTheme,
  id: 'shape-and-divider',
  value: 'shape-and-divider',
  config: {
    ...nativeDarkTheme.config,
    block: {
      ...nativeDarkTheme.config?.block,
      prominent_shape: {
        background: '#D2FF5C',
        border: '1px solid rgba(255,255,255,0.24)',
        'border-left': '5px solid #D2FF5C',
      },
      subtle_shape: {
        background: '#181A19',
        border: '1px solid rgba(255,255,255,0.24)',
      },
      hr: {
        border: 'none',
        'border-top': '1px solid rgba(255,255,255,0.12)',
      },
    },
    components: {
      'section-heading': {
        template:
          '<section style="background:{{shape_bg}};border:1px solid {{shape_border}};border-left:5px solid {{accent_color}}"><section style="height:1px;background:{{line_color}}"></section><section style="height: 1px; background: rgba(255,255,255,0.12)"></section>{{content}}</section>',
        style: {
          shape_bg: '#D2FF5C',
          shape_border: 'rgba(255,255,255,0.24)',
          accent_color: '#D2FF5C',
          line_color: 'rgba(255,255,255,0.12)',
        },
      },
    },
  },
};

const lightShapeTheme: ThemeDefinition = {
  ...lightTheme,
  id: 'light-shape',
  value: 'light-shape',
  config: {
    ...lightTheme.config,
    block: {
      ...lightTheme.config?.block,
      prominent_shape: {
        background: '#1E5BFF',
        border: '2px solid #111111',
      },
      figure: {
        background: '#1E5BFF',
        border: '2px solid #111111',
      },
      image: {
        'background-color': '#FFFFFF',
        border: '2px solid #111111',
      },
    },
    inline: {
      codespan: {
        background: '#1E5BFF',
        border: '2px solid #111111',
      },
    },
    components: {
      'section-heading': {
        template:
          '<section style="background:{{shape_bg}};border-left:4px solid {{shape_border}};border-top:1px solid {{shape_border}};border-right:1px solid {{shape_border}};border-bottom:1px solid {{shape_border}}">{{content}}</section>',
        style: {
          shape_bg: '#1E5BFF',
          shape_border: '#111111',
        },
      },
    },
  },
};

const layeredEmphasisTheme: ThemeDefinition = {
  ...semanticComponentTheme,
  id: 'layered-emphasis',
  value: 'layered-emphasis',
  config: {
    ...semanticComponentTheme.config,
    inline: {
      strong: {
        color: '#182434',
        background: 'linear-gradient(180deg, transparent 62%, rgba(79,195,247,0.16) 62%)',
        'border-bottom': '2px solid rgba(79,195,247,0.32)',
        'font-weight': '800',
      },
    },
    components: {
      title: {
        template:
          '<section style="background: linear-gradient(135deg, rgba(255,255,255,0.68) 0%, rgba(237,244,255,0.78) 100%);"><section style="color: {{title_color}}; font-size: 30px; font-weight: 800;">{{content}}</section></section>',
        style: {
          title_color: '#16202F',
        },
      },
    },
  },
};

describe('applyThemeAppearance', () => {
  it('keeps the theme structure while deriving a readable dark counterpart', () => {
    const darkTheme = applyThemeAppearance(lightTheme, 'dark');
    const surface = resolveThemePaletteSurface(darkTheme);

    expect(darkTheme.palette.appearance).toBe('dark');
    expect(inferThemeAppearance(surface.background)).toBe('dark');
    expect(contrastRatio(surface.background, surface.foreground)).toBeGreaterThanOrEqual(7);
    expect(darkTheme.config?.block?.container?.padding).toBe('20px');
    expect(darkTheme.config?.base?.['font-family']).toBe('serif');
    expect(darkTheme.config?.rules).toEqual(lightTheme.config?.rules);
    expect(Object.keys(darkTheme.config?.components ?? {})).toEqual(['section-heading']);
    expect(darkTheme.config?.components?.['section-heading']?.template).toContain('{{content}}');
    expect(lightTheme.palette.appearance).toBe('light');
    expect(lightTheme.config?.base?.['background-color']).toBe('#FFFCF5');
  });

  it('returns an independent copy when the requested appearance matches the source theme', () => {
    const preservedTheme = applyThemeAppearance(lightTheme, 'light');

    expect(preservedTheme).toEqual(lightTheme);
    expect(preservedTheme).not.toBe(lightTheme);
    expect(preservedTheme.config).not.toBe(lightTheme.config);
  });

  it('provides both readable appearances for every bundled theme', () => {
    const dataset = themesDataset as unknown as ThemesDataset;

    for (const theme of dataset.themes) {
      for (const appearance of ['light', 'dark'] as const) {
        const themedSurface = resolveThemePaletteSurface(applyThemeAppearance(theme, appearance));

        expect(inferThemeAppearance(themedSurface.background), `${theme.value}/${appearance}`).toBe(appearance);
        expect(
          contrastRatio(themedSurface.background, themedSurface.foreground),
          `${theme.value}/${appearance}`,
        ).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('preserves the hue and useful chroma of colorful themes in dark appearance', () => {
    const dataset = themesDataset as unknown as ThemesDataset;
    const colorfulThemes = dataset.themes.filter((theme) => theme.palette.colorFamilies.includes('colorful'));

    for (const theme of colorfulThemes) {
      const darkPreview = resolveThemeAppearancePreview(theme, 'dark');
      const sourcePrimary = inspectPerceptualColor(theme.palette.primary);
      const sourceSecondary = inspectPerceptualColor(theme.palette.secondary);
      const darkPrimary = inspectPerceptualColor(darkPreview.primary);
      const darkSecondary = inspectPerceptualColor(darkPreview.secondary);

      expect(hueDistance(sourcePrimary.hue, darkPrimary.hue), `${theme.value}/primary hue`).toBeLessThan(5);
      expect(hueDistance(sourceSecondary.hue, darkSecondary.hue), `${theme.value}/secondary hue`).toBeLessThan(5);
      expect(darkPrimary.chroma, `${theme.value}/primary chroma`).toBeGreaterThanOrEqual(
        sourcePrimary.chroma * 0.68,
      );
      expect(darkSecondary.chroma, `${theme.value}/secondary chroma`).toBeGreaterThanOrEqual(
        sourceSecondary.chroma * 0.5,
      );
      expect(
        contrastRatio(darkPreview.background, darkPreview.primary),
        `${theme.value}/primary contrast`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps colorful filled title surfaces vivid while retaining readable text', () => {
    const dataset = themesDataset as unknown as ThemesDataset;
    const memphisTheme = dataset.themes.find((theme) => theme.value === 'Neo Memphis Parade')!;
    const sourceStyle = memphisTheme.config?.components?.['title_neo_memphis']?.style;
    const darkStyle = applyThemeAppearance(memphisTheme, 'dark')
      .config?.components?.['title_neo_memphis']?.style;
    const sourceBackground = String(sourceStyle?.accent_yellow);
    const darkBackground = String(darkStyle?.accent_yellow);
    const darkTitle = String(darkStyle?.title_color);

    expect(inspectPerceptualColor(darkBackground).chroma).toBeGreaterThanOrEqual(
      inspectPerceptualColor(sourceBackground).chroma * 0.48,
    );
    expect(contrastRatio(darkBackground, darkTitle)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps every bundled theme geometry identical between light and dark appearances', () => {
    const dataset = themesDataset as unknown as ThemesDataset;

    for (const theme of dataset.themes) {
      const lightAppearance = applyThemeAppearance(theme, 'light');
      const darkAppearance = applyThemeAppearance(theme, 'dark');

      expect(
        normalizeThemeGeometry(darkAppearance),
        theme.value,
      ).toBe(normalizeThemeGeometry(lightAppearance));
    }
  });

  it('maps underscore component tokens into readable local foreground/background pairs', () => {
    const darkTheme = applyThemeAppearance(semanticComponentTheme, 'dark');
    const style = darkTheme.config?.components?.['section-heading']?.style;

    expect(style?.bg_color).not.toBe('#FFFFFF');
    expect(style?.title_color).not.toBe('#111111');
    expect(style?.chip_bg).not.toBe('#F8EEDB');
    expect(style?.chip_text).not.toBe('#312C26');
    expect(style?.accent_yellow).not.toBe('#FFD85A');
    expect(
      contrastRatio(String(style?.bg_color), String(style?.title_color)),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(String(style?.chip_bg), String(style?.chip_text)),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(String(style?.accent_yellow), String(style?.accent_title_color)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('normalizes native dark themes instead of preserving unreadable component values', () => {
    const darkTheme = applyThemeAppearance(nativeDarkTheme, 'dark');
    const style = darkTheme.config?.components?.['section-heading']?.style;

    expect(style?.title_color).not.toBe('#111111');
    expect(
      contrastRatio(String(style?.bg_color), String(style?.title_color)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('always gives dark code blocks an explicit readable foreground for syntax highlighting', () => {
    const darkTheme = applyThemeAppearance(semanticComponentTheme, 'dark');
    const codeStyle = darkTheme.config?.block?.code_pre;
    const surface = resolveThemePaletteSurface(darkTheme);

    expect(codeStyle?.color).toBe(surface.foreground);
  });

  it('keeps shape outline geometry stable while adapting its colors', () => {
    const lightAppearance = applyThemeAppearance(shapeAndDividerTheme, 'light');
    const darkTheme = applyThemeAppearance(shapeAndDividerTheme, 'dark');
    const surface = resolveThemePaletteSurface(darkTheme);
    const lightProminentShape = lightAppearance.config?.block?.prominent_shape;
    const lightSubtleShape = lightAppearance.config?.block?.subtle_shape;
    const prominentShape = darkTheme.config?.block?.prominent_shape;
    const subtleShape = darkTheme.config?.block?.subtle_shape;

    expect(
      contrastRatio(surface.background, String(prominentShape?.background)),
    ).toBeGreaterThanOrEqual(1.35);
    expect(normalizeStyleColors(prominentShape ?? {})).toEqual(
      normalizeStyleColors(lightProminentShape ?? {}),
    );
    expect(prominentShape?.border).not.toBe(lightProminentShape?.border);
    expect(prominentShape?.['border-left']).not.toBe('none');
    expect(subtleShape?.border).toBe(lightSubtleShape?.border);
  });

  it('simplifies redundant shape outlines without recoloring an original light theme', () => {
    const lightAppearance = applyThemeAppearance(lightShapeTheme, 'light');

    expect(lightAppearance.config?.block?.prominent_shape?.border).toBe('none');
    expect(lightAppearance.config?.block?.figure?.border).toBe('none');
    expect(lightAppearance.config?.block?.image?.border).toBe('none');
    expect(lightAppearance.config?.inline?.codespan?.border).toBe('none');
    expect(lightAppearance.config?.components?.['section-heading']?.template).toContain('border-left:4px');
    expect(lightAppearance.config?.components?.['section-heading']?.template).not.toContain('border-top:1px');
    expect(lightAppearance.config?.components?.['section-heading']?.template).not.toContain('border-right:1px');
    expect(lightAppearance.config?.components?.['section-heading']?.template).not.toContain('border-bottom:1px');
    expect(lightAppearance.config?.base).toEqual(lightShapeTheme.config?.base);
    expect(lightAppearance.palette).toEqual(lightShapeTheme.palette);
  });

  it('keeps one-pixel title dividers visible in dark appearances', () => {
    const darkTheme = applyThemeAppearance(shapeAndDividerTheme, 'dark');
    const surface = resolveThemePaletteSurface(darkTheme);
    const component = darkTheme.config?.components?.['section-heading'];
    const lineColor = String(component?.style?.line_color);
    const hardcodedLineColor = component?.template?.match(
      /height:\s*1px;\s*background:\s*(#[\dA-F]{6})/i,
    )?.[1];

    expect(contrastRatio(surface.background, lineColor)).toBeGreaterThanOrEqual(3);
    expect(hardcodedLineColor).toBeTruthy();
    expect(
      contrastRatio(surface.background, String(hardcodedLineColor)),
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps a title readable against every stop of a long dark gradient declaration', () => {
    const darkTheme = applyThemeAppearance(layeredEmphasisTheme, 'dark');
    const surface = resolveThemePaletteSurface(darkTheme);
    const component = darkTheme.config?.components?.title;
    const titleColor = String(component?.style?.title_color);
    const gradient = component?.template?.match(/linear-gradient\([^;]+\)/)?.[0] ?? '';
    const colorStops = [...gradient.matchAll(
      /rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)/g,
    )];

    expect(colorStops).toHaveLength(2);
    for (const stop of colorStops) {
      const alpha = Number(stop[4]);
      const backgroundChannels = surface.background.match(/[\dA-F]{2}/gi)?.map((channel) =>
        Number.parseInt(channel, 16)
      ) ?? [];
      const compositeColor = `#${[1, 2, 3]
        .map((index) => Math.round(
          Number(stop[index]) * alpha + Number(backgroundChannels[index - 1]) * (1 - alpha),
        ).toString(16).padStart(2, '0'))
        .join('')}`;

      expect(contrastRatio(compositeColor, titleColor)).toBeGreaterThanOrEqual(7);
    }
  });

  it('keeps the strong-text highlight geometry and changes only its colors in dark mode', () => {
    const lightAppearance = applyThemeAppearance(layeredEmphasisTheme, 'light');
    const darkTheme = applyThemeAppearance(layeredEmphasisTheme, 'dark');
    const surface = resolveThemePaletteSurface(darkTheme);
    const lightStrongStyle = lightAppearance.config?.inline?.strong ?? {};
    const strongStyle = darkTheme.config?.inline?.strong;
    const quoteBackground = String(darkTheme.config?.block?.blockquote?.background);
    const bandColor = String(strongStyle?.background).match(/rgba\([^)]*\)/)?.[0] ?? '';
    const paintedBandColor = compositeRgbaOverHex(bandColor, surface.background);
    const paintedQuoteBandColor = compositeRgbaOverHex(bandColor, quoteBackground);

    expect(strongStyle?.background).not.toBe('none');
    expect(strongStyle?.['border-bottom']).not.toBe('none');
    expect(strongStyle).not.toHaveProperty('text-decoration-line');
    expect(Object.keys(strongStyle ?? {})).toEqual(Object.keys(lightStrongStyle));
    expect(normalizeStyleColors(strongStyle ?? {})).toEqual(normalizeStyleColors(lightStrongStyle));
    expect(strongStyle?.background).not.toBe(lightStrongStyle.background);
    expect(strongStyle?.color).not.toBe(lightStrongStyle.color);
    expect(contrastRatio(surface.background, paintedBandColor)).toBeGreaterThanOrEqual(1.6);
    expect(contrastRatio(paintedBandColor, surface.foreground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(paintedQuoteBandColor, surface.foreground)).toBeGreaterThanOrEqual(4.5);
  });
});

function hueDistance(firstHue: number, secondHue: number): number {
  const distance = Math.abs(firstHue - secondHue) % 360;
  return Math.min(distance, 360 - distance);
}

describe('resolveThemeAppearancePreview', () => {
  it('uses the requested appearance without rebuilding the full theme', () => {
    const lightPreview = resolveThemeAppearancePreview(lightTheme, 'light');
    const darkPreview = resolveThemeAppearancePreview(lightTheme, 'dark');

    expect(inferThemeAppearance(lightPreview.background)).toBe('light');
    expect(inferThemeAppearance(darkPreview.background)).toBe('dark');
    expect(lightPreview.primary).not.toBe(darkPreview.primary);
  });
});

describe('selectThemeAppearance', () => {
  it('prioritizes the URL request, then storage, then the light default', () => {
    expect(selectThemeAppearance({ requestedAppearance: 'dark', storedAppearance: 'light' })).toBe('dark');
    expect(selectThemeAppearance({ storedAppearance: 'dark' })).toBe('dark');
    expect(selectThemeAppearance({})).toBe('light');
  });

  it('logs discarded invalid state before falling back', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(selectThemeAppearance({ requestedAppearance: 'night', storedAppearance: 'dark' })).toBe('dark');
    expect(warnSpy).toHaveBeenCalledWith(
      '[theme-preview] invalid requested appearance="night". Falling back to stored appearance="dark".',
    );

    warnSpy.mockRestore();
  });
});
