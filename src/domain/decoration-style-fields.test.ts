import { describe, expect, it } from 'vitest';
import { listEditableDecorationColorFields } from './decoration-style-fields';

describe('listEditableDecorationColorFields', () => {
  it('includes color-named fields and css color-valued fields', () => {
    expect(
      listEditableDecorationColorFields({
        background: '#111111',
        accent_color: '#D2FF5C',
        sub_line_color: 'rgba(255,255,255,0.16)',
        padding: '24px 20px',
        shadow: '0 18px 36px rgba(0,0,0,0.12)',
      }),
    ).toEqual([
      { key: 'background', value: '#111111' },
      { key: 'accent_color', value: '#D2FF5C' },
      { key: 'sub_line_color', value: 'rgba(255,255,255,0.16)' },
    ]);
  });
});
