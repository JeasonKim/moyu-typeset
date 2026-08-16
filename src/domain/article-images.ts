export interface LocalArticleImage {
  url: string;
  relativePath: string;
}

export interface ArticleImageSource {
  label: string;
  imageDataUrl(relativePath: string): Promise<string | null>;
}

export interface EmbedLocalArticleImagesInput {
  markdown: string;
  source: ArticleImageSource;
}

export interface ArticleImageEmbeddingResult {
  markdown: string;
  referencedImageCount: number;
  embeddedImageCount: number;
  unresolvedImages: LocalArticleImage[];
}

const markdownImagePattern = /!\[[^\]]*]\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const htmlImagePattern = /<img\b[^>]*\bsrc=(["'])(.*?)\1/gi;
const directlyRenderableImagePattern = /^(https?:|data:|blob:|\/\/)/i;
const imageDataUrlPattern = /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i;

export function collectLocalArticleImages(markdown: string): LocalArticleImage[] {
  const imageUrls = collectArticleImageUrls(markdown);
  const localImages: LocalArticleImage[] = [];

  for (const url of imageUrls) {
    if (directlyRenderableImagePattern.test(url)) {
      continue;
    }

    const relativePath = normalizeArticleImagePath(url);
    if (!relativePath) {
      continue;
    }

    localImages.push({ url, relativePath });
  }

  return localImages;
}

export async function embedLocalArticleImages(
  input: EmbedLocalArticleImagesInput,
): Promise<ArticleImageEmbeddingResult> {
  const localImages = collectLocalArticleImages(input.markdown);
  const replacements = new Map<string, string>();
  const unresolvedImages: LocalArticleImage[] = [];

  await Promise.all(
    localImages.map(async (image) => {
      try {
        const dataUrl = await input.source.imageDataUrl(image.relativePath);
        if (!dataUrl || !imageDataUrlPattern.test(dataUrl)) {
          unresolvedImages.push(image);
          console.warn(
            `[article-images] local image unresolved url="${image.url}" path="${image.relativePath}" source="${input.source.label}" reason="${
              dataUrl ? 'source returned non-image data URL' : 'file not found'
            }". Keeping local image placeholder.`,
          );
          return;
        }

        replacements.set(image.url, dataUrl);
      } catch (error) {
        unresolvedImages.push(image);
        console.warn(
          `[article-images] local image read failed url="${image.url}" path="${image.relativePath}" source="${input.source.label}" reason="${String(
            error,
          )}". Keeping local image placeholder.`,
        );
      }
    }),
  );

  return {
    markdown: replaceArticleImageUrls(input.markdown, replacements),
    referencedImageCount: localImages.length,
    embeddedImageCount: replacements.size,
    unresolvedImages: localImages.filter((image) =>
      unresolvedImages.some((unresolvedImage) => unresolvedImage.url === image.url),
    ),
  };
}

function collectArticleImageUrls(markdown: string): string[] {
  const imageUrls = new Set<string>();

  for (const match of markdown.matchAll(markdownImagePattern)) {
    imageUrls.add(stripAngleBrackets(match[1]));
  }

  for (const match of markdown.matchAll(htmlImagePattern)) {
    imageUrls.add(match[2]);
  }

  return [...imageUrls];
}

function normalizeArticleImagePath(url: string): string | null {
  const pathWithoutSuffix = url.split('#', 1)[0].split('?', 1)[0];
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(pathWithoutSuffix).replaceAll('\\', '/');
  } catch (error) {
    console.warn(
      `[article-images] local image ignored url="${url}" reason="invalid URL encoding: ${String(error)}". Keeping local image placeholder.`,
    );
    return null;
  }

  if (!decodedPath || decodedPath.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(decodedPath)) {
    console.warn(
      `[article-images] local image ignored url="${url}" reason="absolute local path is unavailable to the browser". Keeping local image placeholder.`,
    );
    return null;
  }

  const normalizedSegments: string[] = [];
  for (const segment of decodedPath.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (normalizedSegments.length === 0) {
        console.warn(
          `[article-images] local image ignored url="${url}" reason="outside article directory". Keeping local image placeholder.`,
        );
        return null;
      }
      normalizedSegments.pop();
      continue;
    }
    normalizedSegments.push(segment);
  }

  if (normalizedSegments.length === 0) {
    console.warn(
      `[article-images] local image ignored url="${url}" reason="empty normalized path". Keeping local image placeholder.`,
    );
    return null;
  }

  return normalizedSegments.join('/');
}

function replaceArticleImageUrls(markdown: string, replacements: Map<string, string>): string {
  const markdownImagesEmbedded = markdown.replace(markdownImagePattern, (imageMarkdown, capturedUrl: string) => {
    const originalUrl = stripAngleBrackets(capturedUrl);
    const replacement = replacements.get(originalUrl);
    return replacement ? imageMarkdown.replace(capturedUrl, replacement) : imageMarkdown;
  });

  return markdownImagesEmbedded.replace(
    htmlImagePattern,
    (imageHtml, _quote: string, originalUrl: string) => {
      const replacement = replacements.get(originalUrl);
      return replacement ? imageHtml.replace(originalUrl, replacement) : imageHtml;
    },
  );
}

function stripAngleBrackets(value: string): string {
  return value.startsWith('<') && value.endsWith('>') ? value.slice(1, -1) : value;
}
