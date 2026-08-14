import { describe, expect, it } from 'vitest';
import { styleControlEventNames } from './style-control-events';

describe('styleControlEventNames', () => {
  it('previews continuous controls on input and commits them on change', () => {
    expect(styleControlEventNames({ tagName: 'input', inputType: 'range' })).toEqual(['input', 'change']);
    expect(styleControlEventNames({ tagName: 'input', inputType: 'color' })).toEqual(['input', 'change']);
  });

  it('keeps text and select controls committed on change', () => {
    expect(styleControlEventNames({ tagName: 'input', inputType: 'text' })).toEqual(['change']);
    expect(styleControlEventNames({ tagName: 'select' })).toEqual(['change']);
  });
});
