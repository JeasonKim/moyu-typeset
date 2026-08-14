export interface StyleControlDescriptor {
  tagName: string;
  inputType?: string;
}

export type StyleControlEventName = 'input' | 'change';

export function styleControlEventNames(control: StyleControlDescriptor): StyleControlEventName[] {
  const isInput = control.tagName.toLowerCase() === 'input';
  const inputType = control.inputType?.toLowerCase();

  if (isInput && inputType === 'range') {
    return ['input', 'change'];
  }

  if (isInput && inputType === 'color') {
    return ['input', 'change'];
  }

  return ['change'];
}
