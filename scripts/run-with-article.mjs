import { spawn, spawnSync } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { resolveConfiguredArticlePath } from './article-source-rules.mjs';

const command = process.argv[2];
const articlePath = process.argv[3];

if (!command || !['dev', 'build'].includes(command)) {
  console.error('[theme-preview] usage: node scripts/run-with-article.mjs <dev|build> [article.md]');
  process.exit(1);
}

const env = {
  ...process.env,
  ...(articlePath ? { ARTICLE_MD: articlePath } : {}),
};

run('node', ['scripts/prepare-article.mjs'], env);

if (command === 'dev') {
  runDevServer(env, articlePath);
} else {
  run('tsc', [], env);
  run('vite', ['build'], env);
}

function run(binary, args, env) {
  const result = spawnSync(binary, args, {
    env,
    shell: true,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runDevServer(env, articlePath) {
  const vite = spawn('vite', ['--host', '127.0.0.1'], {
    env,
    shell: true,
    stdio: 'inherit',
  });
  const stopWatching = watchArticleSource(articlePath, env);

  const stop = () => {
    stopWatching();
    vite.kill('SIGTERM');
  };

  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stop();
    process.exit(0);
  });

  vite.on('exit', (code) => {
    stopWatching();
    process.exit(code ?? 0);
  });
}

function watchArticleSource(articlePath, env) {
  const configuredArticlePath = resolveConfiguredArticlePath({
    environmentPath: process.env.ARTICLE_MD,
    argumentPath: articlePath,
  });
  const absoluteArticlePath = resolve(configuredArticlePath);
  const watchTarget = existsSync(absoluteArticlePath) ? absoluteArticlePath : dirname(absoluteArticlePath);
  let debounceTimer;

  if (!existsSync(watchTarget)) {
    console.warn(
      `[theme-preview] article watch target missing path="${watchTarget}". Hot reload is disabled until restart.`,
    );
    return () => undefined;
  }

  const watcher = watch(watchTarget, { persistent: true }, (_eventType, filename) => {
    if (watchTarget !== absoluteArticlePath && filename && resolve(watchTarget, filename) !== absoluteArticlePath) {
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[theme-preview] article changed path="${configuredArticlePath}". Regenerating preview content.`);
      run('node', ['scripts/prepare-article.mjs'], env);
    }, 120);
  });

  console.log(`[theme-preview] watching article path="${configuredArticlePath}".`);

  return () => {
    clearTimeout(debounceTimer);
    watcher.close();
  };
}
