import type {
  StyleMap,
  ThemeAppearance,
  ThemeComponent,
  ThemeDefinition,
} from './theme-types';
import { resolveThemePaletteSurface } from './theme-palette';

export interface ThemeAppearancePreview {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
}

export interface ThemeAppearanceSelectionInput {
  requestedAppearance?: string | null;
  storedAppearance?: string | null;
  defaultAppearance?: ThemeAppearance;
}

type ThemeColorRole = 'background' | 'foreground' | 'headline' | 'border' | 'divider' | 'accent' | 'shadow';
type ThemeVariableRoleMap = Map<string, ThemeColorRole>;

interface RgbColor {
  red: number;
  green: number;
  blue: number;
  alpha?: number;
}

interface EmphasisPaintPolicy {
  minimumAlpha: number;
  maximumAlpha: number;
  protectForeground: boolean;
}

const themeAppearanceLabels: Record<ThemeAppearance, string> = {
  light: '亮色',
  dark: '暗色',
};

const colorTokenPattern = /#[\da-f]{6}\b|#[\da-f]{3}\b|rgba?\([^)]*\)|(?<![\w-])(?:white|black)(?![\w-])/gi;
const strongEmphasisBandPolicy: EmphasisPaintPolicy = {
  minimumAlpha: 0.15,
  maximumAlpha: 0.9,
  protectForeground: true,
};
const strongEmphasisBorderPolicy: EmphasisPaintPolicy = {
  minimumAlpha: 0.78,
  maximumAlpha: 1,
  protectForeground: false,
};
const minimumEmphasisBandContrast = 1.35;
const minimumStrongBandTextContrast = 4.6;

export function applyThemeAppearance(
  theme: ThemeDefinition,
  appearance: ThemeAppearance,
): ThemeDefinition {
  const themedCopy = retireRedundantThemeOutlines(structuredClone(theme));
  if (theme.palette.appearance === appearance && appearance === 'light') {
    return themedCopy;
  }

  const preview = resolveThemeAppearancePreview(theme, appearance);
  const config = themedCopy.config ?? {};
  const blockStyles = Object.fromEntries(
    Object.entries(config.block ?? {}).map(([target, style]) => [
      target,
      adaptThemeStyle(style, preview, undefined, target),
    ]),
  );
  const componentStyles = Object.fromEntries(
    Object.entries(config.components ?? {}).map(([name, component]) => [
      name,
      adaptThemeComponent(component, preview),
    ]),
  );
  const contentSurfaces = collectThemeContentSurfaces(blockStyles, componentStyles, preview);
  const inlineStyles = Object.fromEntries(
    Object.entries(config.inline ?? {}).map(([target, style]) => [
      target,
      adaptInlineThemeStyle(target, style, preview, contentSurfaces),
    ]),
  );

  // 主题结构保持不变，只替换阅读表面的语义色；用户仍然看到同一套版式。
  const base = adaptThemeStyle(config.base ?? {}, preview);
  base.color = preview.foreground;
  base['background-color'] = preview.background;

  const container = adaptThemeStyle(blockStyles.container ?? {}, preview);
  container.color = preview.foreground;
  container['background-color'] = preview.background;

  // 代码块必须显式声明前景色，渲染器才能选择与暗色表面匹配的语法高亮。
  blockStyles.code_pre = {
    ...blockStyles.code_pre,
    color: preview.foreground,
  };
  blockStyles.code = {
    ...blockStyles.code,
    color: preview.foreground,
  };

  themedCopy.palette = {
    ...themedCopy.palette,
    appearance,
    primary: preview.primary,
    secondary: preview.secondary,
  };
  themedCopy.section_html = themedCopy.section_html
    ? adaptThemeTemplate(themedCopy.section_html, preview)
    : themedCopy.section_html;
  themedCopy.config = {
    ...config,
    base,
    block: {
      ...blockStyles,
      container,
    },
    inline: inlineStyles,
    components: componentStyles,
  };

  return themedCopy;
}

function retireRedundantThemeOutlines(theme: ThemeDefinition): ThemeDefinition {
  const preview = resolveThemeAppearancePreview(theme, 'light');
  const config = theme.config;
  if (!config) {
    return theme;
  }

  const figureSurface = resolveStyleSurface(config.block?.figure, preview.background);
  const block = Object.fromEntries(
    Object.entries(config.block ?? {}).map(([target, style]) => [
      target,
      simplifyFilledShapeOutline(
        style,
        preview,
        target === 'image' ? figureSurface : preview.background,
      ),
    ]),
  );
  const inline = Object.fromEntries(
    Object.entries(config.inline ?? {}).map(([target, style]) => [
      target,
      simplifyFilledShapeOutline(style, preview),
    ]),
  );
  const components = Object.fromEntries(
    Object.entries(config.components ?? {}).map(([name, component]) => [
      name,
      {
        ...component,
        ...(component.template
          ? { template: simplifyTemplateShapeOutlines(component.template, component.style, preview) }
          : {}),
        ...(component.variants
          ? {
              variants: Object.fromEntries(
                Object.entries(component.variants).map(([variantName, variant]) => [
                  variantName,
                  {
                    ...variant,
                    ...(variant.template
                      ? { template: simplifyTemplateShapeOutlines(variant.template, component.style, preview) }
                      : {}),
                  },
                ]),
              ),
            }
          : {}),
      },
    ]),
  );

  if (theme.section_html) {
    theme.section_html = simplifyTemplateShapeOutlines(theme.section_html, undefined, preview);
  }
  theme.config = {
    ...config,
    block,
    ...(config.inline ? { inline } : {}),
    components,
  };
  return theme;
}

export function resolveThemeAppearancePreview(
  theme: ThemeDefinition,
  appearance: ThemeAppearance,
): ThemeAppearancePreview {
  if (theme.palette.appearance === appearance) {
    const surface = resolveThemePaletteSurface(theme);
    return {
      ...surface,
      primary: theme.palette.primary,
      secondary: theme.palette.secondary,
    };
  }

  const primary = normalizedPaletteColor(theme.palette.primary, theme, 'primary');
  const secondary = normalizedPaletteColor(theme.palette.secondary, theme, 'secondary');
  const appearanceSurface = appearance === 'light'
    ? {
        background: mixColors('#FFFEFC', primary, 0.04),
        foreground: '#242824',
      }
    : {
        background: mixColors('#101412', primary, 0.06),
        foreground: '#EFF3F0',
      };

  return {
    ...appearanceSurface,
    primary: adaptAccentColor(primary, appearanceSurface.background, appearance),
    secondary: adaptSecondaryColor(secondary, appearanceSurface.background, appearance),
  };
}

export function selectThemeAppearance(input: ThemeAppearanceSelectionInput): ThemeAppearance {
  const fallbackAppearance = validThemeAppearance(input.storedAppearance)
    ? input.storedAppearance
    : input.defaultAppearance ?? 'light';

  if (input.requestedAppearance && !validThemeAppearance(input.requestedAppearance)) {
    console.warn(
      `[theme-preview] invalid requested appearance="${input.requestedAppearance}". Falling back to stored appearance="${fallbackAppearance}".`,
    );
    return fallbackAppearance;
  }

  if (validThemeAppearance(input.requestedAppearance)) {
    return input.requestedAppearance;
  }

  if (input.storedAppearance && !validThemeAppearance(input.storedAppearance)) {
    const defaultAppearance = input.defaultAppearance ?? 'light';
    console.warn(
      `[theme-preview] invalid stored appearance="${input.storedAppearance}". Falling back to default appearance="${defaultAppearance}".`,
    );
    return defaultAppearance;
  }

  return fallbackAppearance;
}

export function themeAppearanceLabel(appearance: ThemeAppearance): string {
  return themeAppearanceLabels[appearance];
}

function adaptThemeComponent(
  component: ThemeComponent,
  preview: ThemeAppearancePreview,
): ThemeComponent {
  const variableRoles = collectThemeVariableRoles(component);
  const componentStyle = component.style
    ? adaptThemeStyle(component.style, preview, variableRoles)
    : component.style;
  const adaptComponentTemplate = (template: string): string => adaptThemeTemplate(template, preview);

  return {
    ...component,
    template: component.template ? adaptComponentTemplate(component.template) : component.template,
    style: componentStyle,
    variants: component.variants
      ? Object.fromEntries(
          Object.entries(component.variants).map(([name, variant]) => [
            name,
            {
              ...variant,
              template: variant.template
                ? adaptComponentTemplate(variant.template)
                : variant.template,
            },
          ]),
        )
      : component.variants,
  };
}

function adaptThemeStyle(
  style: StyleMap,
  preview: ThemeAppearancePreview,
  variableRoles?: ThemeVariableRoleMap,
  styleTarget?: string,
): StyleMap {
  const adaptedStyle = Object.fromEntries(
    Object.entries(style).map(([property, value]) => {
      if (typeof value !== 'string') {
        return [property, value];
      }

      const colorRole = variableRoles?.get(property) ?? resolveStyleColorRole(property, styleTarget);
      return colorRole ? [property, adaptColorTokens(value, colorRole, preview)] : [property, value];
    }),
  );

  return adaptedStyle;
}

function adaptInlineThemeStyle(
  target: string,
  style: StyleMap,
  preview: ThemeAppearancePreview,
  contentSurfaces: string[],
): StyleMap {
  const adaptedStyle = adaptThemeStyle(style, preview, undefined, target);
  const highlightBackground = typeof style.background === 'string' && style.background.includes('gradient');
  const bottomBorder = typeof style['border-bottom'] === 'string' && style['border-bottom'] !== 'none';
  if (target !== 'strong' || !isDarkColor(preview.background) || (!highlightBackground && !bottomBorder)) {
    return adaptedStyle;
  }

  return {
    ...adaptedStyle,
    color: preview.foreground,
    ...(highlightBackground
      ? {
          background: adaptStrongEmphasisPaint(
            String(style.background),
            preview,
            contentSurfaces,
            strongEmphasisBandPolicy,
          ),
        }
      : {}),
    ...(bottomBorder
      ? {
          'border-bottom': adaptStrongEmphasisPaint(
            String(style['border-bottom']),
            preview,
            contentSurfaces,
            strongEmphasisBorderPolicy,
          ),
        }
      : {}),
  };
}

function adaptStrongEmphasisPaint(
  paint: string,
  preview: ThemeAppearancePreview,
  contentSurfaces: string[],
  policy: EmphasisPaintPolicy,
): string {
  return paint.replace(colorTokenPattern, (token) => {
    const sourceColor = parseCssColor(token);
    if (!sourceColor) {
      return token;
    }

    const emphasisColor = parseCssColor(adaptEmphasisDecorationColor(sourceColor, preview))!;
    const alpha = resolveStrongEmphasisAlpha(
      sourceColor,
      emphasisColor,
      preview,
      contentSurfaces,
      policy,
    );
    return alpha >= 1 ? rgbToHex(emphasisColor) : rgbaString(emphasisColor, alpha);
  });
}

function resolveStrongEmphasisAlpha(
  sourceColor: RgbColor,
  emphasisColor: RgbColor,
  preview: ThemeAppearancePreview,
  contentSurfaces: string[],
  policy: EmphasisPaintPolicy,
): number {
  if (!policy.protectForeground) {
    return Math.min(1, Math.max(sourceColor.alpha ?? 1, policy.minimumAlpha));
  }

  // 色带保持可见，同时限制覆盖字形下部后的亮度，避免装饰抢过文字。
  for (let alpha = policy.maximumAlpha; alpha >= policy.minimumAlpha; alpha -= 0.02) {
    const paintedBand = compositeSolidColor(rgbaString(emphasisColor, alpha), preview.background)!;
    if (
      colorContrast(preview.background, paintedBand) >= minimumEmphasisBandContrast &&
      contentSurfaces.every((surface) => {
        const localBand = compositeSolidColor(rgbaString(emphasisColor, alpha), surface)!;
        return colorContrast(preview.foreground, localBand) >= minimumStrongBandTextContrast;
      })
    ) {
      return alpha;
    }
  }

  return policy.minimumAlpha;
}

function collectThemeContentSurfaces(
  blockStyles: Record<string, StyleMap>,
  components: Record<string, ThemeComponent>,
  preview: ThemeAppearancePreview,
): string[] {
  const surfaces = new Set<string>([preview.background]);
  const collectStyleSurface = (style: StyleMap, variableRoles?: ThemeVariableRoleMap): void => {
    for (const [property, value] of Object.entries(style)) {
      const role = variableRoles?.get(property) ?? themeColorRole(property);
      if (role !== 'background' || typeof value !== 'string') {
        continue;
      }

      for (const token of value.match(colorTokenPattern) ?? []) {
        const surface = compositeSolidColor(token, preview.background);
        if (surface) {
          surfaces.add(surface);
        }
      }
    }
  };

  const strongContentTargets = new Set([
    'container',
    'p',
    'blockquote',
    'td',
    'th',
    'listitem',
  ]);
  for (const [target, style] of Object.entries(blockStyles)) {
    if (strongContentTargets.has(target)) {
      collectStyleSurface(style);
    }
  }

  for (const [name, component] of Object.entries(components)) {
    const normalizedName = name.toLowerCase().replaceAll('-', '_');
    if (!normalizedName.includes('quote') && !normalizedName.includes('content_wrap')) {
      continue;
    }
    if (component.style) {
      collectStyleSurface(component.style, collectThemeVariableRoles(component));
    }
  }

  return [...surfaces];
}

function adaptEmphasisDecorationColor(
  sourceColor: RgbColor,
  preview: ThemeAppearancePreview,
): string {
  if (!isChromatic(sourceColor)) {
    return preview.foreground;
  }

  // 强调线会同时出现在正文、引用和卡片表面；提高亮度余量，避免只对正文背景可见。
  return adaptAccentColor(rgbToHex(sourceColor), preview.background, 'dark', 7);
}

function collectThemeVariableRoles(component: ThemeComponent): ThemeVariableRoleMap {
  const variableRoles: ThemeVariableRoleMap = new Map();
  const templates = [
    component.template,
    ...Object.values(component.variants ?? {}).map((variant) => variant.template),
  ].filter((template): template is string => Boolean(template));

  for (const template of templates) {
    for (const styleAttribute of template.matchAll(/style="([^"]*)"/gi)) {
      for (const declaration of styleAttribute[1].matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
        const role = resolveTemplateDeclarationRole(declaration[1], styleAttribute[1]);
        if (!role) {
          continue;
        }

        for (const placeholder of declaration[2].matchAll(/{{\s*([\w-]+)\s*}}/g)) {
          const variableName = placeholder[1];
          const variableRole = themeColorRole(variableName);
          const resolvedRole = variableRole && themeColorRolePriority(variableRole) > themeColorRolePriority(role)
            ? variableRole
            : role;
          const storedRole = variableRoles.get(variableName);
          if (!storedRole || themeColorRolePriority(resolvedRole) > themeColorRolePriority(storedRole)) {
            variableRoles.set(variableName, resolvedRole);
          }
        }
      }
    }
  }

  return variableRoles;
}

function themeColorRolePriority(role: ThemeColorRole): number {
  const priorities: Record<ThemeColorRole, number> = {
    shadow: 1,
    accent: 2,
    background: 3,
    border: 4,
    divider: 5,
    foreground: 6,
    headline: 7,
  };
  return priorities[role];
}

function adaptThemeTemplate(template: string, preview: ThemeAppearancePreview): string {
  return template.replace(colorTokenPattern, (token, offset: number, source: string) => {
    const styleAttributeStart = source.lastIndexOf('style="', offset);
    const styleAttributeEnd = styleAttributeStart >= 0
      ? source.indexOf('"', styleAttributeStart + 7)
      : -1;
    const styleAttribute = styleAttributeStart >= 0 && styleAttributeEnd >= offset
      ? source.slice(styleAttributeStart + 7, styleAttributeEnd)
      : '';
    const declarationOffset = styleAttributeStart >= 0 ? offset - styleAttributeStart - 7 : -1;
    const declarationPrefix = declarationOffset >= 0
      ? styleAttribute.slice(0, declarationOffset)
      : source.slice(Math.max(0, offset - 48), offset);
    const property = declarationPrefix.match(/(?:^|;)\s*([\w-]+)\s*:[^;]*$/)?.[1];
    const role = property
      ? resolveTemplateDeclarationRole(property, styleAttribute) ?? 'accent'
      : 'accent';
    return adaptColorToken(token, role, preview);
  });
}

function resolveStyleColorRole(property: string, styleTarget?: string): ThemeColorRole | null {
  const normalizedProperty = property.toLowerCase().replaceAll('_', '-');
  const isHeadingDivider = /^h[1-6]$/.test(styleTarget ?? '') && normalizedProperty.startsWith('border-');
  const isHorizontalRule = styleTarget === 'hr' && normalizedProperty.startsWith('border');
  return isHeadingDivider || isHorizontalRule ? 'divider' : themeColorRole(property);
}

function resolveTemplateDeclarationRole(
  property: string,
  styleAttribute: string,
): ThemeColorRole | null {
  return isThinDividerBackground(property, styleAttribute) ? 'divider' : themeColorRole(property);
}

function isThinDividerBackground(property: string, styleAttribute: string): boolean {
  const normalizedProperty = property.toLowerCase().replaceAll('_', '-');
  if (normalizedProperty !== 'background' && normalizedProperty !== 'background-color') {
    return false;
  }

  const height = styleAttribute.match(/(?:^|;)\s*height\s*:\s*(\d+(?:\.\d+)?)px\b/i)?.[1];
  return height !== undefined && Number(height) <= 2;
}

function themeColorRole(property: string): ThemeColorRole | null {
  const normalizedProperty = property.toLowerCase().replaceAll('_', '-');
  if (
    normalizedProperty.includes('background') ||
    normalizedProperty === 'bg' ||
    normalizedProperty.startsWith('bg-') ||
    normalizedProperty.endsWith('-bg') ||
    normalizedProperty.includes('-bg-') ||
    normalizedProperty.includes('gradient')
  ) {
    return 'background';
  }
  if (
    (normalizedProperty.includes('title') || normalizedProperty.includes('heading')) &&
    (normalizedProperty.endsWith('-color') || normalizedProperty.endsWith('-text'))
  ) {
    return 'headline';
  }
  if (normalizedProperty.includes('primary') || normalizedProperty.includes('accent')) {
    return 'accent';
  }
  if (
    normalizedProperty.includes('bullet') ||
    normalizedProperty.includes('ornament') ||
    normalizedProperty.includes('quote')
  ) {
    return 'accent';
  }
  if (normalizedProperty.includes('shadow')) {
    return 'shadow';
  }
  if (
    normalizedProperty.includes('divider') ||
    normalizedProperty === 'line-color' ||
    normalizedProperty.endsWith('-line-color') ||
    normalizedProperty.includes('underline')
  ) {
    return 'divider';
  }
  if (
    normalizedProperty.includes('border') ||
    normalizedProperty.includes('outline') ||
    normalizedProperty.includes('decoration')
  ) {
    return 'border';
  }
  if (normalizedProperty.includes('stroke')) {
    return 'foreground';
  }
  if (
    normalizedProperty === 'color' ||
    normalizedProperty.endsWith('-color') ||
    normalizedProperty.endsWith('-text') ||
    normalizedProperty.includes('foreground')
  ) {
    return 'foreground';
  }
  return null;
}

function adaptColorTokens(
  value: string,
  role: ThemeColorRole,
  preview: ThemeAppearancePreview,
): string {
  return value.replace(colorTokenPattern, (token) => adaptColorToken(token, role, preview));
}

function adaptColorToken(
  token: string,
  role: ThemeColorRole,
  preview: ThemeAppearancePreview,
): string {
  const sourceColor = parseCssColor(token);
  if (!sourceColor) {
    return token;
  }

  const appearance = isDarkColor(preview.background) ? 'dark' : 'light';
  const sourceHex = rgbToHex(sourceColor);
  let adaptedHex: string;

  if (role === 'background') {
    adaptedHex = isChromatic(sourceColor)
      ? mixColors(sourceHex, preview.background, appearance === 'dark' ? 0.72 : 0.82)
      : mixColors(preview.background, preview.foreground, appearance === 'dark' ? 0.08 : 0.035);
  } else if (role === 'border') {
    adaptedHex = isChromatic(sourceColor)
      ? mixColors(adaptAccentColor(sourceHex, preview.background, appearance), preview.background, 0.36)
      : mixColors(preview.foreground, preview.background, appearance === 'dark' ? 0.68 : 0.78);
  } else if (role === 'divider') {
    adaptedHex = adaptDividerColor(sourceColor, sourceHex, preview, appearance);
  } else if (role === 'headline') {
    adaptedHex = adaptAccentColor(
      sourceHex,
      preview.background,
      appearance,
      appearance === 'dark' ? 9 : 7,
    );
  } else if (role === 'shadow') {
    adaptedHex = appearance === 'dark' ? '#000000' : '#26312B';
  } else if (role === 'accent') {
    adaptedHex = adaptAccentColor(sourceHex, preview.background, appearance);
  } else if (isChromatic(sourceColor)) {
    adaptedHex = adaptAccentColor(sourceHex, preview.background, appearance, 6);
  } else {
    const sourceLuminance = colorLuminance(sourceColor);
    adaptedHex = sourceLuminance > 0.22 && sourceLuminance < 0.72
      ? mixColors(preview.foreground, preview.background, appearance === 'dark' ? 0.18 : 0.2)
      : preview.foreground;
  }

  const adaptedAlpha = role === 'divider'
    ? undefined
    : (role === 'foreground' || role === 'headline') && sourceColor.alpha !== undefined && sourceColor.alpha > 0
      ? Math.max(role === 'headline' ? 0.9 : 0.82, sourceColor.alpha)
      : sourceColor.alpha;

  return adaptedAlpha === undefined
    ? adaptedHex
    : rgbaString(parseCssColor(adaptedHex)!, adaptedAlpha);
}

function adaptDividerColor(
  sourceColor: RgbColor,
  sourceHex: string,
  preview: ThemeAppearancePreview,
  appearance: ThemeAppearance,
): string {
  const dividerBase = isChromatic(sourceColor)
    ? adaptAccentColor(sourceHex, preview.background, appearance, 4.5)
    : preview.foreground;
  let backgroundWeight = 0.56;
  let dividerColor = mixColors(dividerBase, preview.background, backgroundWeight);

  while (colorContrast(preview.background, dividerColor) < 3 && backgroundWeight > 0) {
    backgroundWeight = Math.max(0, backgroundWeight - 0.08);
    dividerColor = mixColors(dividerBase, preview.background, backgroundWeight);
  }

  return dividerColor;
}

function simplifyFilledShapeOutline(
  style: StyleMap,
  preview: ThemeAppearancePreview,
  surroundingBackground = preview.background,
): StyleMap {
  if (!hasDistinctShapeFill(style, preview, surroundingBackground)) {
    return style;
  }

  return Object.fromEntries(
    Object.entries(style).map(([property, value]) => {
      const normalizedProperty = property.toLowerCase().replaceAll('_', '-');
      return normalizedProperty === 'border' || normalizedProperty === 'outline'
        ? [property, 'none']
        : [property, value];
    }),
  );
}

function simplifyTemplateShapeOutlines(
  template: string,
  style: StyleMap | undefined,
  preview: ThemeAppearancePreview,
): string {
  return template.replace(/style="([^"]*)"/gi, (attribute, declarations: string) => {
    const resolvedDeclarations = declarations.replace(
      /{{\s*([\w-]+)\s*}}/g,
      (_, variableName: string) => String(style?.[variableName] ?? ''),
    );
    if (!hasDistinctShapeFill(parseStyleDeclarations(resolvedDeclarations), preview)) {
      return attribute;
    }

    const simplifiedDeclarations = declarations
      .replace(
        /(^|;)(\s*)(border|outline)\s*:[^;]*/gi,
        (_, prefix: string, spacing: string, property: string) => `${prefix}${spacing}${property}: none`,
      )
      .replace(
        /(^|;)(\s*)(border-(?:top|right|bottom))\s*:\s*(\d+(?:\.\d+)?)px\s+[^;]*/gi,
        (
          declaration: string,
          prefix: string,
          spacing: string,
          property: string,
          width: string,
        ) => Number(width) <= 1 ? `${prefix}${spacing}${property}: none` : declaration,
      );
    return `style="${simplifiedDeclarations}"`;
  });
}

function parseStyleDeclarations(declarations: string): StyleMap {
  const style: StyleMap = {};
  for (const declaration of declarations.matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]+)/g)) {
    style[declaration[1]] = declaration[2].trim();
  }
  return style;
}

function hasDistinctShapeFill(
  style: StyleMap,
  preview: ThemeAppearancePreview,
  surroundingBackground = preview.background,
): boolean {
  const backgroundValue = style['background-color'] ?? style.background_color ?? style.background;
  if (typeof backgroundValue !== 'string') {
    return false;
  }

  const shapeColor = compositeSolidColor(backgroundValue, surroundingBackground);
  return shapeColor !== null && colorContrast(shapeColor, surroundingBackground) >= 1.35;
}

function resolveStyleSurface(style: StyleMap | undefined, fallbackBackground: string): string {
  if (!style) {
    return fallbackBackground;
  }

  const backgroundValue = style['background-color'] ?? style.background_color ?? style.background;
  return typeof backgroundValue === 'string'
    ? compositeSolidColor(backgroundValue, fallbackBackground) ?? fallbackBackground
    : fallbackBackground;
}

function compositeSolidColor(color: string, background: string): string | null {
  const foregroundColor = parseCssColor(color);
  const backgroundColor = parseCssColor(background);
  if (!foregroundColor || !backgroundColor) {
    return null;
  }

  const alpha = foregroundColor.alpha ?? 1;
  return rgbToHex({
    red: foregroundColor.red * alpha + backgroundColor.red * (1 - alpha),
    green: foregroundColor.green * alpha + backgroundColor.green * (1 - alpha),
    blue: foregroundColor.blue * alpha + backgroundColor.blue * (1 - alpha),
  });
}

function adaptAccentColor(
  color: string,
  background: string,
  appearance: ThemeAppearance,
  minimumContrast = 3,
): string {
  const target = appearance === 'dark' ? '#FFFFFF' : '#000000';
  const initialWeight = appearance === 'dark' ? 0.22 : 0.08;
  let adaptedColor = mixColors(color, target, initialWeight);
  let targetWeight = initialWeight;

  while (colorContrast(background, adaptedColor) < minimumContrast && targetWeight < 0.92) {
    targetWeight += 0.08;
    adaptedColor = mixColors(color, target, targetWeight);
  }

  return adaptedColor;
}

function adaptSecondaryColor(
  color: string,
  background: string,
  appearance: ThemeAppearance,
): string {
  const adaptedAccent = adaptAccentColor(color, background, appearance);
  return mixColors(adaptedAccent, background, appearance === 'dark' ? 0.28 : 0.2);
}

function normalizedPaletteColor(
  color: string,
  theme: ThemeDefinition,
  field: 'primary' | 'secondary',
): string {
  if (parseCssColor(color)) {
    return rgbToHex(parseCssColor(color)!);
  }

  const fallback = field === 'primary' ? '#52635A' : '#A7B0AA';
  console.warn(
    `[theme-preview] invalid palette ${field} theme="${theme.value || theme.id}" color="${color}". Falling back to "${fallback}".`,
  );
  return fallback;
}

function validThemeAppearance(value: unknown): value is ThemeAppearance {
  return value === 'light' || value === 'dark';
}

function parseCssColor(value: string): RgbColor | null {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'white') {
    return { red: 255, green: 255, blue: 255 };
  }
  if (normalizedValue === 'black') {
    return { red: 0, green: 0, blue: 0 };
  }
  if (/^#[\da-f]{3}$/i.test(normalizedValue)) {
    return {
      red: Number.parseInt(normalizedValue[1] + normalizedValue[1], 16),
      green: Number.parseInt(normalizedValue[2] + normalizedValue[2], 16),
      blue: Number.parseInt(normalizedValue[3] + normalizedValue[3], 16),
    };
  }
  if (/^#[\da-f]{6}$/i.test(normalizedValue)) {
    return {
      red: Number.parseInt(normalizedValue.slice(1, 3), 16),
      green: Number.parseInt(normalizedValue.slice(3, 5), 16),
      blue: Number.parseInt(normalizedValue.slice(5, 7), 16),
    };
  }

  const rgbMatch = normalizedValue.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+)\s*)?\)$/);
  if (!rgbMatch) {
    return null;
  }

  return {
    red: clampChannel(Number(rgbMatch[1])),
    green: clampChannel(Number(rgbMatch[2])),
    blue: clampChannel(Number(rgbMatch[3])),
    alpha: rgbMatch[4] === undefined ? undefined : Math.min(1, Math.max(0, Number(rgbMatch[4]))),
  };
}

function mixColors(firstColor: string, secondColor: string, secondWeight: number): string {
  const first = parseCssColor(firstColor);
  const second = parseCssColor(secondColor);
  if (!first || !second) {
    throw new Error(`[theme-preview] cannot mix invalid colors first="${firstColor}" second="${secondColor}".`);
  }

  return rgbToHex({
    red: first.red + (second.red - first.red) * secondWeight,
    green: first.green + (second.green - first.green) * secondWeight,
    blue: first.blue + (second.blue - first.blue) * secondWeight,
  });
}

function colorContrast(firstColor: string, secondColor: string): number {
  const first = colorLuminance(parseCssColor(firstColor)!);
  const second = colorLuminance(parseCssColor(secondColor)!);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function colorLuminance(color: RgbColor): number {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const normalizedChannel = channel / 255;
    return normalizedChannel <= 0.04045
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function isDarkColor(color: string): boolean {
  return colorLuminance(parseCssColor(color)!) < 0.18;
}

function isChromatic(color: RgbColor): boolean {
  return Math.max(color.red, color.green, color.blue) - Math.min(color.red, color.green, color.blue) >= 24;
}

function rgbToHex(color: RgbColor): string {
  const channels = [color.red, color.green, color.blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('');
  return `#${channels.toUpperCase()}`;
}

function rgbaString(color: RgbColor, alpha: number): string {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${Number(alpha.toFixed(3))})`;
}

function clampChannel(channel: number): number {
  return Math.min(255, Math.max(0, Math.round(channel)));
}
