import { describe, expect, it } from 'vitest';
import { evaluateNodeRuntime, isNativeBindingFailure } from './environment-rules.mjs';

describe('evaluateNodeRuntime', () => {
  it('accepts Node versions supported by Vite', () => {
    expect(evaluateNodeRuntime('v20.19.0', 'darwin', 'arm64').ok).toBe(true);
    expect(evaluateNodeRuntime('v22.12.0', 'win32', 'x64').ok).toBe(true);
    expect(evaluateNodeRuntime('v24.15.0', 'win32', 'x64').ok).toBe(true);
  });

  it('rejects Node versions outside the supported engine range', () => {
    expect(evaluateNodeRuntime('v20.18.1', 'darwin', 'arm64')).toEqual({
      ok: false,
      reason: 'Node.js v20.18.1 不满足项目要求，请使用 20.19.x 或 22.12+。',
    });
    expect(evaluateNodeRuntime('v21.7.0', 'win32', 'x64').ok).toBe(false);
  });

  it('rejects unsupported Windows and macOS architectures', () => {
    expect(evaluateNodeRuntime('v22.12.0', 'win32', 'ia32').ok).toBe(false);
    expect(evaluateNodeRuntime('v22.12.0', 'darwin', 'ppc').ok).toBe(false);
  });
});

describe('isNativeBindingFailure', () => {
  it('detects platform native dependency failures', () => {
    expect(
      isNativeBindingFailure(
        '@rolldown\\binding-win32-x64-msvc\\rolldown-binding.win32-x64-msvc.node is not a valid Win32 application.',
      ),
    ).toBe(true);
    expect(isNativeBindingFailure('Error: Cannot find native binding.')).toBe(true);
  });

  it('ignores ordinary command failures', () => {
    expect(isNativeBindingFailure('Missing #app root.')).toBe(false);
  });
});
