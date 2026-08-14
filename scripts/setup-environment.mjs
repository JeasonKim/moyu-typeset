import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModulesPath = resolve(projectRoot, 'node_modules');

runNode(['scripts/doctor-environment.mjs', '--node-only']);
warnPackageManifestChanges();

for (let attempt = 1; attempt <= 2; attempt += 1) {
  reinstallDependencies(attempt);

  const doctor = runNode(['scripts/doctor-environment.mjs'], { allowFailure: true });
  if (doctor.status === 0) {
    console.log(`[theme-preview] setup complete after attempt=${attempt}.`);
    process.exit(0);
  }

  if (attempt === 1) {
    console.warn(
      `[theme-preview] dependency verification failed after install attempt=${attempt}. Clearing npm cache and retrying once.`,
    );
    runNpm(['cache', 'clean', '--force']);
    continue;
  }

  console.error('[theme-preview] setup failed after retry. Check the error above and confirm Node/npm architecture matches this machine.');
  process.exit(doctor.status ?? 1);
}

function reinstallDependencies(attempt) {
  if (existsSync(nodeModulesPath)) {
    console.warn(`[theme-preview] removing stale node_modules before install attempt=${attempt}.`);
    rmSync(nodeModulesPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }

  runNpm(['ci', '--include=optional']);
}

function runNode(args, options = {}) {
  return run(process.execPath, args, options);
}

function runNpm(args, options = {}) {
  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, options);
}

function warnPackageManifestChanges() {
  const gitStatus = spawnSync('git', ['status', '--short', '--', 'package.json', 'package-lock.json'], {
    cwd: projectRoot,
    shell: false,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (gitStatus.status !== 0) {
    return;
  }

  const changedManifests = gitStatus.stdout.trim();
  if (changedManifests) {
    console.warn(
      [
        '[theme-preview] package manifests have local changes. npm ci will use the current files.',
        'For deterministic Agent preview, restore package.json and package-lock.json before running setup.',
        changedManifests,
      ].join('\n'),
    );
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    shell: false,
    stdio: options.allowFailure ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (!options.allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (options.allowFailure && result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    if (output) {
      console.error(output);
    }
  }

  return result;
}
