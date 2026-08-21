import { describe, expect, it } from 'vitest';
import { styleControlEventNames } from './style-control-events';

describe('styleControlEventNames', () => {
  it('previews continuous controls on input and commits them on change', () => {
    expect(styleControlEventNames({ tagName: 'input', inputType: 'range' })).toEqual(['input', 'change']);
    expect(styleControlEventNames({ tagName: 'input', inputType: 'color' })).toEqual(['input', 'change']);
  });

  it('previews text and toggle inputs continuously while selects commit immediately', () => {
    expect(styleControlEventNames({ tagName: 'input', inputType: 'text' })).toEqual(['input', 'change']);
    expect(styleControlEventNames({ tagName: 'input', inputType: 'checkbox' })).toEqual(['input', 'change']);
    expect(styleControlEventNames({ tagName: 'select' })).toEqual(['change']);
  });
});
