import { describe, expect, it, vi } from 'vitest';
import {
  applyThemeStyleOverrides,
  buildPreviewBoardStyle,
  buildPreviewBoardStyleMap,
  shadowStyleForLevel,
} from './style-overrides';
import type { ThemeStyleOverrides } from './style-editor-types';
import type { ThemeDefinition } from './theme-types';

const baseOverrides: ThemeStyleOverrides = {
  text: {
    p: {
      color: '#222222',
      'font-size': '16px',
    },
  },
  strong: {
    color: '#000000',
    background: 'transparent',
  },
  image: {
    image: {
      'max-width': '88%',
      'border-radius': '8px',
    },
    figure: {
      'box-shadow': 'none',
    },
    figcaption: {
      display: 'block',
    },
  },
  background: {
    container: {
      'background-color': '#ffffff',
      padding: '1rem 2rem',
    },
  },
  decorations: {
    hero: {
      accent_color: '#ff5a3d',
    },
  },
};

const theme: ThemeDefinition = {
  id: 'theme-a',
  label: '主题 A',
  value: 'theme-a',
  config: {
    base: {
      color: '#111111',
    },
    block: {
      p: {
        color: '#444444',
        margin: '20px 0',
      },
      image: {
        width: '100%',
      },
    },
    inline: {
      strong: {
        'font-weight': '700',
      },
    },
    components: {
      hero: {
        enabled: true,
        style: {
          accent_color: '#111111',
        },
        template: '<section>{{content}}</section>',
      },
    },
  },
};

describe('applyThemeStyleOverrides', () => {
  it('merges text, image, background and decoration overrides without mutating the source theme', () => {
    const nextTheme = applyThemeStyleOverrides(theme, baseOverrides);

    expect(nextTheme.config?.block?.p).toEqual({
      color: '#222222',
      margin: '20px 0',
      'font-size': '16px',
    });
    expect(nextTheme.config?.block?.image).toEqual({
      width: '100%',
      'max-width': '88%',
      'border-radius': '8px',
    });
    expect(nextTheme.config?.inline?.strong?.background).toBe('transparent');
    expect(nextTheme.config?.components?.hero.style?.accent_color).toBe('#ff5a3d');
    expect(theme.config?.components?.hero.style?.accent_color).toBe('#111111');
  });

  it('logs when decoration overrides target a missing component', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    applyThemeStyleOverrides(theme, {
      ...baseOverrides,
      decorations: {
        missing: {
          color: '#ffffff',
        },
      },
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('component="missing"'));
    warn.mockRestore();
  });
});

describe('buildPreviewBoardStyle', () => {
  it('returns no style when board pattern is disabled', () => {
    expect(
      buildPreviewBoardStyle({
        enabled: false,
        pattern: 'fine-grid',
        size: 15,
        opacity: 30,
        color: '#f59e0b',
      }),
    ).toBe('');
  });

  it('builds grid, dot and cross background patterns', () => {
    const gridStyle = buildPreviewBoardStyle({
        enabled: true,
        pattern: 'fine-grid',
        size: 15,
        opacity: 30,
        color: '#f59e0b',
      });

    expect(gridStyle).toContain('linear-gradient');
    expect(gridStyle).not.toContain('background-color');

    expect(
      buildPreviewBoardStyle({
        enabled: true,
        pattern: 'dot',
        size: 18,
        opacity: 40,
        color: '#f59e0b',
      }),
    ).toContain('radial-gradient');

    expect(
      buildPreviewBoardStyle({
        enabled: true,
        pattern: 'cross',
        size: 20,
        opacity: 50,
        color: '#f59e0b',
      }),
    ).toContain('45deg');
  });

  it('returns a style map that can be merged into the article container', () => {
    expect(
      buildPreviewBoardStyleMap({
        enabled: true,
        pattern: 'standard-grid',
        size: 24,
        opacity: 30,
        color: '#f59e0b',
      }),
    ).toEqual({
      'background-image':
        'linear-gradient(rgba(245, 158, 11, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.3) 1px, transparent 1px)',
      'background-size': '24px 24px',
    });
  });
});

describe('shadowStyleForLevel', () => {
  it('maps shadow levels to css values', () => {
    expect(shadowStyleForLevel('none')).toBe('none');
    expect(shadowStyleForLevel('heavy')).toContain('52px');
  });
});
