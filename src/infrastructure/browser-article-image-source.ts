import type { ArticleImageSource } from '../domain/article-images';

export interface LocateOpenedArticleInput {
  files: ReadonlyArray<File>;
  fileName: string;
  markdown: string;
}

export interface SelectedDirectoryArticleImageSourceInput {
  files: ReadonlyArray<File>;
  articleDirectoryPath: string;
}

export interface DirectoryArticleIdentity {
  fileName: string;
  markdown: string;
}

const imageMimeTypes: Record<string, string> = {
  apng: 'image/apng',
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export function articleImageSourceFromDirectoryHandle(
  directoryHandle: FileSystemDirectoryHandle,
): ArticleImageSource {
  return {
    label: `授权目录“${directoryHandle.name}”`,
    async imageDataUrl(relativePath): Promise<string | null> {
      const file = await fileFromDirectoryHandle(directoryHandle, relativePath);
      return file ? fileAsImageDataUrl(file) : null;
    },
  };
}

export function articleImageSourceFromSelectedDirectory(
  input: SelectedDirectoryArticleImageSourceInput,
): ArticleImageSource {
  const filesByPath = indexSelectedDirectoryFiles(input.files);

  return {
    label: '用户选择的文章附件',
    async imageDataUrl(relativePath): Promise<string | null> {
      const fullPath = joinRelativePath(input.articleDirectoryPath, relativePath);
      const file = filesByPath.get(fullPath);
      return file ? fileAsImageDataUrl(file) : null;
    },
  };
}

export async function directoryContainsOpenedArticle(
  directoryHandle: FileSystemDirectoryHandle,
  identity: DirectoryArticleIdentity,
): Promise<boolean> {
  try {
    const articleHandle = await directoryHandle.getFileHandle(identity.fileName);
    const articleFile = await articleHandle.getFile();
    return (await articleFile.text()) === identity.markdown;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

export async function locateOpenedArticleInSelectedDirectory(
  input: LocateOpenedArticleInput,
): Promise<string | null> {
  const markdownCandidates = input.files.filter((file) => file.name === input.fileName);
  const matchingArticles = (
    await Promise.all(
      markdownCandidates.map(async (candidate) => ((await candidate.text()) === input.markdown ? candidate : null)),
    )
  ).filter((candidate): candidate is File => candidate !== null);

  if (matchingArticles.length === 1) {
    return directoryName(selectedDirectoryRelativePath(matchingArticles[0]));
  }

  if (matchingArticles.length > 1) {
    console.warn(
      `[article-images] selected directory rejected article="${input.fileName}" reason="multiple identical article files" matches="${matchingArticles
        .map(selectedDirectoryRelativePath)
        .join(',')}".`,
    );
  }
  return null;
}

async function fileFromDirectoryHandle(
  rootDirectory: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File | null> {
  const pathSegments = relativePath.split('/').filter(Boolean);
  const fileName = pathSegments.pop();
  if (!fileName) {
    return null;
  }

  try {
    let currentDirectory = rootDirectory;
    for (const directoryName of pathSegments) {
      currentDirectory = await currentDirectory.getDirectoryHandle(directoryName);
    }
    const fileHandle = await currentDirectory.getFileHandle(fileName);
    return fileHandle.getFile();
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

function indexSelectedDirectoryFiles(files: ReadonlyArray<File>): Map<string, File> {
  const filesByPath = new Map<string, File>();

  for (const file of files) {
    const relativePath = selectedDirectoryRelativePath(file);
    if (filesByPath.has(relativePath)) {
      console.warn(
        `[article-images] duplicate selected file ignored path="${relativePath}" kept="${filesByPath.get(relativePath)?.name}" discarded="${file.name}".`,
      );
      continue;
    }
    filesByPath.set(relativePath, file);
  }

  return filesByPath;
}

function selectedDirectoryRelativePath(file: File): string {
  const pathSegments = file.webkitRelativePath.split('/').filter(Boolean);
  return pathSegments.length > 1 ? pathSegments.slice(1).join('/') : file.name;
}

function directoryName(path: string): string {
  const lastSeparator = path.lastIndexOf('/');
  return lastSeparator === -1 ? '' : path.slice(0, lastSeparator);
}

function joinRelativePath(directoryPath: string, relativePath: string): string {
  return directoryPath ? `${directoryPath}/${relativePath}` : relativePath;
}

async function fileAsImageDataUrl(file: File): Promise<string> {
  const mimeType = file.type || mimeTypeFromFileName(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 32_768;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

function mimeTypeFromFileName(fileName: string): string {
  const extension = fileName.split('.').at(-1)?.toLowerCase() ?? '';
  return imageMimeTypes[extension] ?? 'application/octet-stream';
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}
