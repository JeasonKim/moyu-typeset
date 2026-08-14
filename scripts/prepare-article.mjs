import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfiguredArticlePath } from './article-source-rules.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configuredArticlePath = resolveConfiguredArticlePath({
  environmentPath: process.env.ARTICLE_MD,
  argumentPath: process.argv[2],
});
const articlePath = resolve(projectRoot, configuredArticlePath);
const hasArticleSource = existsSync(articlePath);
const sourcePath = hasArticleSource ? articlePath : resolve(projectRoot, configuredArticlePath);
const sourceMarkdown = hasArticleSource
  ? readFileSync(sourcePath, 'utf8')
  : '# 文章标题\n\n未找到默认演示文档，请检查 `demo.md` 是否存在。\n';

if (!hasArticleSource) {
  console.warn(
    `[theme-preview] article source not found path="${configuredArticlePath}". Generated placeholder article.`,
  );
}

const preparedMarkdown = embedLocalImagesAsDataUrls(sourceMarkdown, sourcePath);
const outputPath = resolve(projectRoot, 'src/data/generated-article.ts');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `export const generatedArticleMarkdown = ${JSON.stringify(preparedMarkdown.markdown)};\n\n` +
    `export const generatedArticleStats = ${JSON.stringify(
      {
        sourcePath: relativeFromProject(sourcePath),
        imageCount: preparedMarkdown.imageCount,
        embeddedImageCount: preparedMarkdown.embeddedImageCount,
        failedImageCount: preparedMarkdown.failedImageCount,
      },
      null,
      2,
    )} as const;\n`,
);

function embedLocalImagesAsDataUrls(markdown, markdownPath) {
  const imageUrls = collectImageUrls(markdown);
  const replacements = new Map();
  let failedImageCount = 0;

  for (const imageUrl of imageUrls) {
    if (!isLocalImageUrl(imageUrl)) {
      continue;
    }

    try {
      const imagePath = resolveImagePath(imageUrl, markdownPath);
      const mimeType = mimeTypeForPath(imagePath);
      const dataUrl = `data:${mimeType};base64,${readFileSync(imagePath).toString('base64')}`;
      replacements.set(imageUrl, dataUrl);
    } catch (error) {
      failedImageCount += 1;
      console.warn(
        `[theme-preview] local image inline failed url="${imageUrl}" article="${relativeFromProject(
          markdownPath,
        )}" reason="${String(error)}". Keeping original image URL.`,
      );
    }
  }

  let nextMarkdown = markdown;
  for (const [imageUrl, dataUrl] of replacements.entries()) {
    nextMarkdown = nextMarkdown.split(imageUrl).join(dataUrl);
  }

  return {
    markdown: nextMarkdown,
    imageCount: imageUrls.length,
    embeddedImageCount: replacements.size,
    failedImageCount,
  };
}

function collectImageUrls(markdown) {
  const imageUrls = new Set();
  const markdownImagePattern = /!\[[^\]]*]\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
  const htmlImagePattern = /<img\b[^>]*\bsrc=(["'])(.*?)\1/gi;

  for (const match of markdown.matchAll(markdownImagePattern)) {
    imageUrls.add(stripAngleBrackets(match[1]));
  }

  for (const match of markdown.matchAll(htmlImagePattern)) {
    imageUrls.add(match[2]);
  }

  return [...imageUrls];
}

function stripAngleBrackets(value) {
  return value.startsWith('<') && value.endsWith('>') ? value.slice(1, -1) : value;
}

function isLocalImageUrl(url) {
  return !/^(https?:|data:|blob:|mailto:|#|\/\/)/i.test(url);
}

function resolveImagePath(url, markdownPath) {
  const cleanUrl = decodeURIComponent(url.split('#')[0].split('?')[0]);
  const candidates = isAbsolute(cleanUrl)
    ? [cleanUrl, resolve(projectRoot, 'public', cleanUrl.slice(1)), resolve(projectRoot, cleanUrl.slice(1))]
    : [resolve(dirname(markdownPath), cleanUrl)];

  const imagePath = candidates.find((candidate) => existsSync(candidate));
  if (!imagePath) {
    throw new Error(`file not found candidates=${candidates.map((candidate) => `"${candidate}"`).join(',')}`);
  }

  return imagePath;
}

function mimeTypeForPath(path) {
  const extension = extname(path).toLowerCase();
  const mimeTypes = {
    '.apng': 'image/apng',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  };

  return mimeTypes[extension] ?? 'application/octet-stream';
}

function relativeFromProject(path) {
  return path.startsWith(projectRoot) ? path.slice(projectRoot.length + 1) : path;
}
