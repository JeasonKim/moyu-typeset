import type { StyleMap } from './theme-types';

export interface DecorationColorField {
  key: string;
  value: string;
}

export function listEditableDecorationColorFields(style: StyleMap): DecorationColorField[] {
  return Object.entries(style)
    .filter((entry): entry is [string, string] => {
      const [key, value] = entry;
      return typeof value === 'string' && (key.toLowerCase().includes('color') || isCssColorValue(value));
    })
    .map(([key, value]) => ({ key, value }));
}

function isCssColorValue(value: string): boolean {
  const normalizedValue = value.trim();
  return (
    /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(normalizedValue) ||
    /^rgba?\(/i.test(normalizedValue) ||
    /^hsla?\(/i.test(normalizedValue) ||
    normalizedValue === 'transparent'
  );
}
