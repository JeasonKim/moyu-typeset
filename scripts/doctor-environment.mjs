import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateNodeRuntime, isNativeBindingFailure } from './environment-rules.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeOnly = process.argv.includes('--node-only');

const runtime = evaluateNodeRuntime(process.version, process.platform, process.arch);
if (!runtime.ok) {
  console.error(`[theme-preview] environment invalid: ${runtime.reason}`);
  process.exit(1);
}

if (nodeOnly) {
  console.log(`[theme-preview] node runtime ok version="${process.version}" platform="${process.platform}" arch="${process.arch}".`);
  process.exit(0);
}

const viteBin = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(viteBin)) {
  console.error(
    '[theme-preview] dependencies missing: node_modules/vite/bin/vite.js not found. Run `npm run setup` before starting preview.',
  );
  process.exit(1);
}

const viteCheck = spawnSync(process.execPath, [viteBin, '--version'], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (viteCheck.status !== 0) {
  const output = `${viteCheck.stdout ?? ''}\n${viteCheck.stderr ?? ''}`;
  if (isNativeBindingFailure(output)) {
    console.error(
      [
        '[theme-preview] native dependency invalid: Vite/Rolldown 原生绑定加载失败。',
        '请运行 `npm run setup` 清理 node_modules、重新安装可选原生依赖并验证环境。',
        `runtime version="${process.version}" platform="${process.platform}" arch="${process.arch}"`,
        output.trim(),
      ].join('\n'),
    );
  } else {
    console.error(
      [
        '[theme-preview] vite check failed. Run `npm run setup` to restore dependencies.',
        `runtime version="${process.version}" platform="${process.platform}" arch="${process.arch}"`,
        output.trim(),
      ].join('\n'),
    );
  }
  process.exit(viteCheck.status ?? 1);
}

console.log(`[theme-preview] environment ok ${viteCheck.stdout.trim()}.`);
