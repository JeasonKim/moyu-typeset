export interface StyleControlDescriptor {
  tagName: string;
  inputType?: string;
}

export type StyleControlEventName = 'input' | 'change';

export function styleControlEventNames(control: StyleControlDescriptor): StyleControlEventName[] {
  const isInput = control.tagName.toLowerCase() === 'input';

  if (isInput) {
    return ['input', 'change'];
  }

  return ['change'];
}
