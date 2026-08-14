export function resolveConfiguredArticlePath({ environmentPath, argumentPath }) {
  return environmentPath || argumentPath || 'demo.md';
}
