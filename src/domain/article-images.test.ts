import { describe, expect, it, vi } from 'vitest';
import {
  collectLocalArticleImages,
  embedLocalArticleImages,
  type ArticleImageSource,
} from './article-images';

describe('collectLocalArticleImages', () => {
  it('collects unique Markdown and HTML local images while ignoring directly renderable URLs', () => {
    const markdown = [
      '![封面](./assets/cover.png)',
      '![重复封面](./assets/cover.png)',
      '![带标题](<./assets/detail image.png> "详情")',
      '<img alt="工作台" src="images/workbench.png">',
      '![网络图](https://example.com/remote.png)',
      '![内嵌图](data:image/png;base64,dGVzdA==)',
      '![临时图](blob:https://example.com/asset)',
      '![协议相对图](//example.com/asset.png)',
    ].join('\n\n');

    expect(collectLocalArticleImages(markdown)).toEqual([
      { url: './assets/cover.png', relativePath: 'assets/cover.png' },
      { url: './assets/detail image.png', relativePath: 'assets/detail image.png' },
      { url: 'images/workbench.png', relativePath: 'images/workbench.png' },
    ]);
  });

  it('decodes URL paths and rejects references outside the authorized article directory', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(
      collectLocalArticleImages(
        '![中文图](./assets/%E5%B0%81%E9%9D%A2.png?raw=1#preview)\n\n![越界图](../private.png)',
      ),
    ).toEqual([
      {
        url: './assets/%E5%B0%81%E9%9D%A2.png?raw=1#preview',
        relativePath: 'assets/封面.png',
      },
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('url="../private.png"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reason="outside article directory"'));

    warn.mockRestore();
  });
});

describe('embedLocalArticleImages', () => {
  it('embeds resolved images without replacing ordinary links that use the same URL', async () => {
    const source: ArticleImageSource = {
      label: '测试文章目录',
      async imageDataUrl(relativePath) {
        return relativePath === 'assets/cover.png' ? 'data:image/png;base64,Y292ZXI=' : null;
      },
    };
    const markdown = [
      '![封面](./assets/cover.png)',
      '[下载原图](./assets/cover.png)',
      '<img src="./assets/cover.png" alt="HTML 封面">',
    ].join('\n\n');

    const result = await embedLocalArticleImages({ markdown, source });

    expect(result.markdown).toContain('![封面](data:image/png;base64,Y292ZXI=)');
    expect(result.markdown).toContain('[下载原图](./assets/cover.png)');
    expect(result.markdown).toContain('<img src="data:image/png;base64,Y292ZXI=" alt="HTML 封面">');
    expect(result.referencedImageCount).toBe(1);
    expect(result.embeddedImageCount).toBe(1);
    expect(result.unresolvedImages).toEqual([]);
  });

  it('keeps unresolved images as placeholders and logs the exact fallback decision', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const source: ArticleImageSource = {
      label: '授权目录“文章”',
      async imageDataUrl() {
        return null;
      },
    };

    const result = await embedLocalArticleImages({
      markdown: '![缺失图片](./assets/missing.png)',
      source,
    });

    expect(result.markdown).toBe('![缺失图片](./assets/missing.png)');
    expect(result.embeddedImageCount).toBe(0);
    expect(result.unresolvedImages).toEqual([
      { url: './assets/missing.png', relativePath: 'assets/missing.png' },
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('url="./assets/missing.png"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('source="授权目录“文章”"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Keeping local image placeholder'));

    warn.mockRestore();
  });

  it('continues embedding other images when one image read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const source: ArticleImageSource = {
      label: '测试文章目录',
      async imageDataUrl(relativePath) {
        if (relativePath === 'assets/broken.png') {
          throw new Error('permission revoked');
        }
        return 'data:image/png;base64,b2s=';
      },
    };

    const result = await embedLocalArticleImages({
      markdown: '![损坏](./assets/broken.png)\n\n![正常](./assets/ok.png)',
      source,
    });

    expect(result.embeddedImageCount).toBe(1);
    expect(result.markdown).toContain('![损坏](./assets/broken.png)');
    expect(result.markdown).toContain('![正常](data:image/png;base64,b2s=)');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reason="Error: permission revoked"'));

    warn.mockRestore();
  });
});
