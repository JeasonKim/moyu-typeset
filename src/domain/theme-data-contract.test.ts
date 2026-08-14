import { describe, expect, it } from 'vitest';
import dataset from '../data/themes.json';

describe('theme dataset contract', () => {
  it('keeps one useful name and description per template without legacy tags', () => {
    const themeNames = dataset.themes.map((theme) => theme.label.trim());

    expect(new Set(themeNames).size).toBe(dataset.themes.length);
    expect(dataset.themes.every((theme) => theme.label.trim().length > 0)).toBe(true);
    expect(dataset.themes.every((theme) => theme.description.trim().length > 0)).toBe(true);
    expect(JSON.stringify(dataset)).not.toContain('"tags":');
  });
});
