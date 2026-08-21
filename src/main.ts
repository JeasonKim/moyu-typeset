import './styles.css';
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import themesDataset from './data/themes.json';
import {
  generatedArticleImages,
  generatedArticleMarkdown,
  generatedArticleSourceMarkdown,
  generatedArticleStats,
} from './data/generated-article';
import {
  embedArticleDiagramsAsImages,
  type ArticleDiagramEmbeddingResult,
} from './domain/article-diagrams';
import {
  collectLocalArticleImages,
  embedKnownArticleImages,
  embedLocalArticleImages,
  type ArticleImageEmbeddingResult,
  type ArticleImageSource,
  type LocalArticleImage,
} from './domain/article-images';
import {
  coordinateArticlePreparation,
  type ArticlePreparationOperation,
} from './domain/article-preparation-coordinator';
import { coordinateArticleRevealTransition } from './domain/article-reveal-transition';
import {
  articleDisplayFileName,
  markdownDocumentFromFile,
  supportsMarkdownFile,
  type ArticleDocument,
} from './domain/article-document';
import { restoreArticleDraft, serializeArticleDraft } from './domain/article-draft';
import { decorationFieldLabel, listEditableDecorationColorFields } from './domain/decoration-style-fields';
import { mapSynchronizedScrollPosition } from './domain/editor-preview-scroll';
import type { MarkdownEditingCommand, MarkdownEditingSelection } from './domain/markdown-editing';
import {
  createPristineEditorState,
  focusStyleEditorOnBodyText,
  resetStyleEditorToOriginal,
} from './domain/style-editor-state';
import { styleControlEventNames } from './domain/style-control-events';
import {
  filterThemesByColor,
  themeColorFilters,
  type ThemeColorFilterId,
} from './domain/theme-color-filters';
import { buildTwitterShareUrl, isWechatBrowser, shareMoyuTypesetThroughSystem } from './domain/site-sharing';
import { articlePlainTextFromHtml, canCopyWechatRichText, copyWechatArticle } from './domain/wechat-clipboard';
import { decideWechatCopyEntry } from './domain/wechat-clipboard-consent';
import {
  applyThemeStyleOverrides,
  buildPreviewBoardStyle,
  buildPreviewBoardStyleMap,
  shadowStyleForLevel,
} from './domain/style-overrides';
import { renderThemeMarkdown } from './domain/theme-renderer';
import {
  calculateUnobstructedReadingViewport,
  calculateReadingAnchorScrollAdjustment,
  locateCurrentReadingAnchor,
  type PreviewReadingAnchor,
  type PreviewReadingBlockGeometry,
} from './domain/preview-reading-anchor';
import { coordinateThemeRevealTransition } from './domain/theme-reveal-transition';
import { filterThemesByQuery } from './domain/theme-search';
import { selectPreviewTheme } from './domain/theme-selection';
import {
  applyThemeAppearance,
  resolveThemeAppearancePreview,
  selectThemeAppearance,
  themeAppearanceLabel,
} from './domain/theme-appearance';
import { constrainMarkdownPaneWidth, resizeRightMarkdownPane } from './domain/workbench-layout';
import type { ThemeAppearance, ThemeDefinition, ThemesDataset } from './domain/theme-types';
import type {
  BoardPattern,
  EditorTab,
  StyleEditorState,
  TextStyleTarget,
  ThemeStyleOverrides,
} from './domain/style-editor-types';
import { browserArticleDiagramRenderer } from './infrastructure/browser-article-diagram-renderer';
import {
  articleImageDirectoryPermission,
  canChooseArticleImageDirectory,
  chooseArticleImageDirectory,
  forgetArticleImageDirectory,
  recallArticleImageDirectory,
  rememberArticleImageDirectory,
} from './infrastructure/browser-article-image-directory';
import {
  articleImageSourceFromDirectoryHandle,
  articleImageSourceFromSelectedDirectory,
  directoryContainsOpenedArticle,
  locateOpenedArticleInSelectedDirectory,
  type DirectoryArticleIdentity,
} from './infrastructure/browser-article-image-source';
import {
  mountBrowserMarkdownEditor,
  type BrowserMarkdownEditor,
  type MarkdownEditorScrollMetrics,
} from './infrastructure/browser-markdown-editor';

type PreviewDevice = 'desktop' | 'mobile';
type PreviewRevealPhase = 'idle' | 'brand-loading' | 'curtain-opening';
type PreviewRevealContext = 'theme' | 'article' | null;
type ToastAction = 'open-wechat-editor';
type ArticleImageResolutionPhase = 'permission-required' | 'resolving' | 'partial';
type ArticleDraftSavePhase = 'saved' | 'saving' | 'failed';
type SynchronizedScrollSource = 'markdown' | 'preview' | null;
type SettingsPanelView = 'themes' | 'styles';

interface WechatArticleClipboardContent {
  html: string;
  plainText: string;
}

interface ToastNotice {
  message: string;
  action?: ToastAction;
  actionLabel?: string;
}

interface PreviewScrollPosition {
  top: number;
  left: number;
}

interface PreviewReadingSurface {
  root: HTMLElement;
  viewportTop: number;
  viewportHeight: number;
  scrollTop: number;
  scrollLeft: number;
  restoreScroll: (position: PreviewScrollPosition) => void;
  advanceScroll: (distance: number) => void;
}

interface ArticleImageResolutionState {
  phase: ArticleImageResolutionPhase;
  totalImageCount: number;
  embeddedImageCount: number;
  unresolvedImages: LocalArticleImage[];
}

interface PreparedArticleImages {
  markdown: string;
  resolution: ArticleImageResolutionState | null;
  embeddedImageCount: number;
}

const creatorSiteUrl = 'https://liaobuqi.ren';
const githubRepositoryUrl = 'https://github.com/JeasonKim/moyu-typeset';
const publicSiteUrl = 'https://moyu.liaobuqi.ren/';
const wechatEditorUrl = 'https://mp.weixin.qq.com/';
const wechatClipboardConsentKey = 'moyu-typeset:wechat-clipboard-consent';
const articleDraftStorageKey = 'moyu-typeset:article-draft';
const themeAppearanceStorageKey = 'theme-preview:theme-appearance';
const desktopSettingsPanelWidth = 256;
const minimumMarkdownPaneWidth = 320;
const minimumPreviewPaneWidth = 430;
const workbenchDividerWidth = 1;

const editorTabs: Array<{ id: EditorTab; label: string; icon: string }> = [
  { id: 'text', label: '文本', icon: 'ti-typography' },
  { id: 'image', label: '图片', icon: 'ti-photo' },
  { id: 'background', label: '背景', icon: 'ti-background' },
  { id: 'decoration', label: '装饰', icon: 'ti-sparkles' },
  { id: 'board', label: '底板', icon: 'ti-grid-dots' },
];

const textTargets: Array<{ id: TextStyleTarget; label: string }> = [
  { id: 'h1', label: '一级标题' },
  { id: 'h2', label: '二级标题' },
  { id: 'h3', label: '三级标题' },
  { id: 'p', label: '正文段落' },
  { id: 'blockquote', label: '引用块' },
  { id: 'hr', label: '分割线' },
];

const boardPresets: Array<{ id: BoardPattern; label: string }> = [
  { id: 'off', label: '关闭' },
  { id: 'fine-grid', label: '细网格' },
  { id: 'standard-grid', label: '标准网格' },
  { id: 'coarse-grid', label: '粗网格' },
  { id: 'dot', label: '圆点' },
  { id: 'cross', label: '交叉' },
];

const dataset = themesDataset as unknown as ThemesDataset;
const bundledArticle: ArticleDocument = {
  fileName: generatedArticleStats.sourcePath.split(/[\\/]/).pop() || 'demo.md',
  markdown: generatedArticleSourceMarkdown,
  source: 'demo',
};
const initialArticleRestoration = restoreArticleDraft(readStoredArticleDraft(), bundledArticle);
if (initialArticleRestoration.status === 'invalid') {
  console.warn(
    `[moyu-editor] stored article draft abandoned reason="${initialArticleRestoration.reason}". Falling back to bundled article="${bundledArticle.fileName}".`,
  );
}
const initialThemeSelection = selectPreviewTheme({
  themes: dataset.themes,
  requestedThemeId: new URLSearchParams(window.location.search).get('theme'),
  storedThemeId: readStoredThemeId(),
});
const initialThemeAppearance = selectThemeAppearance({
  requestedAppearance: new URLSearchParams(window.location.search).get('appearance'),
  storedAppearance: readStoredThemeAppearance(),
});

const state = {
  selectedThemeId: initialThemeSelection.selectedThemeId,
  themeAppearance: initialThemeAppearance,
  article: initialArticleRestoration.article,
  previewMarkdown:
    initialArticleRestoration.status === 'missing'
      ? generatedArticleMarkdown
      : prepareBundledArticleImages(initialArticleRestoration.article),
  articleDraftSavePhase: 'saved' as ArticleDraftSavePhase,
  settingsPanelView: 'themes' as SettingsPanelView,
  markdownPaneWidth: initialMarkdownPaneWidth(),
  markdownSelection: { anchor: 0, head: 0 } as MarkdownEditingSelection,
  markdownScrollTop: 0,
  themeColorFilterId: 'all' as ThemeColorFilterId,
  themeQuery: '',
  previewDevice: 'mobile' as PreviewDevice,
  templateListScrollTop: 0,
  previewScrollTop: 0,
  previewScrollLeft: 0,
  previewReadingAnchor: null as PreviewReadingAnchor | null,
  previewReadingPositionShouldReset: false,
  supportDialogOpen: false,
  mobileShareDialogOpen: false,
  clipboardConsentDialogOpen: false,
  wechatClipboardConsentAcceptedThisSession: readWechatClipboardConsent(),
  previewRevealPhase: 'idle' as PreviewRevealPhase,
  previewRevealContext: null as PreviewRevealContext,
  pendingThemeId: null as string | null,
  articleImages:
    initialArticleRestoration.article.source === 'demo'
      ? null
      : pendingArticleImages(initialArticleRestoration.article.markdown).resolution,
  toast: null as ToastNotice | null,
  editor: readStoredEditorState() ?? createPristineEditorState(firstDecorationTarget(initialThemeSelection.selectedTheme)),
};

let toastTimer: number | undefined;
let previewPositionRestoreFrame: number | undefined;
let openedArticleIdentity: DirectoryArticleIdentity | null = null;
let recentArticleImageDirectory: FileSystemDirectoryHandle | null = null;
let articleImageDirectoryPickerFallbackRequired = false;
let markdownEditor: BrowserMarkdownEditor | null = null;
let articleDraftSaveTimer: number | undefined;
let editedArticlePreparationTimer: number | undefined;
let synchronizedScrollSource: SynchronizedScrollSource = null;
let synchronizedScrollFrame: number | undefined;

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app root.');
}
const app = appRoot;
const recentArticleImageDirectoryReady = recallRecentArticleImageDirectory();
const articlePreparation = coordinateArticlePreparation();
const themeRevealTransition = coordinateThemeRevealTransition({
  brandLoadingMs: 800,
  curtainOpeningMs: 1_400,
  scheduler: {
    schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
    cancel: (timerId) => window.clearTimeout(timerId),
  },
  presentation: {
    showBrandLoading: () => {
      state.previewRevealContext = 'theme';
      state.previewRevealPhase = 'brand-loading';
      renderApp();
    },
    openThemeCurtain: () => {
      state.previewRevealPhase = 'curtain-opening';
      renderApp();
    },
    concludeThemeReveal: concludePreviewReveal,
  },
});
const articleRevealTransition = coordinateArticleRevealTransition({
  minimumLoadingMs: 600,
  curtainOpeningMs: 1_400,
  clock: {
    now: () => window.performance.now(),
  },
  scheduler: {
    schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
    cancel: (timerId) => window.clearTimeout(timerId),
  },
  presentation: {
    showLoading: () => {
      state.previewRevealContext = 'article';
      state.previewRevealPhase = 'brand-loading';
      renderApp();
    },
    openCurtain: () => {
      state.previewRevealPhase = 'curtain-opening';
      renderApp();
    },
    concludeReveal: concludePreviewReveal,
  },
});

function concludePreviewReveal(): void {
  state.previewRevealPhase = 'idle';
  state.previewRevealContext = null;
  state.pendingThemeId = null;
  app.querySelector<HTMLElement>('[data-preview-reveal]')?.remove();
  app.querySelector<HTMLElement>('[data-article-drop-zone]')?.removeAttribute('aria-busy');
}

function renderApp(): void {
  rememberTemplateListScroll();
  rememberPreviewReadingPosition();
  rememberMarkdownEditorState();
  markdownEditor?.destroy();
  markdownEditor = null;

  const sourceTheme = requireSelectedTheme(dataset.themes, state.selectedThemeId);
  const selectedTheme = applyThemeAppearance(sourceTheme, state.themeAppearance);
  normalizeDecorationTarget(sourceTheme);
  const editedTheme = applyThemeStyleOverrides(
    selectedTheme,
    buildPreviewOverrides(state.editor),
    state.editor.decorationPreferences,
  );
  const renderedPreview = renderPreview(editedTheme);
  const visibleTemplateThemes = filterThemesByQuery(
    filterThemesByColor(dataset.themes, state.themeColorFilterId),
    state.themeQuery,
  );

  app.innerHTML = `
    <main class="appShell">
      <header class="commandBar">
        <div class="brandLockup">
          <img class="brandMark" src="/moyu-mark.svg" alt="" aria-hidden="true">
          <span class="brandText">
            <strong>墨鱼排版</strong>
            <a
              class="creatorByline"
              href="${creatorSiteUrl}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="访问了不起的人个人主页"
              title="去「了不起的人」看看其他作品"
            >
              <span>了不起的人 · 出品</span><i class="ti ti-arrow-up-right"></i>
            </a>
          </span>
        </div>
        <div class="mobileHeaderActions" aria-label="站点相关操作">
          <a href="${githubRepositoryUrl}" target="_blank" rel="noopener noreferrer" aria-label="查看 GitHub 开源仓库" title="GitHub 开源仓库">
            <i class="ti ti-brand-github"></i>
          </a>
          <button type="button" data-open-mobile-share aria-label="分享墨鱼排版" title="分享本站">
            <i class="ti ti-share-3"></i>
          </button>
        </div>
        <div class="siteHeaderSummary" aria-label="站点用途">
          <strong>公众号 Markdown 排版</strong>
          <span>本地编辑 · 实时预览</span>
        </div>
        <button class="publishButton" type="button" data-copy-article>
          <i class="ti ti-brand-wechat"></i><span>复制到公众号</span>
        </button>
      </header>

      <section class="workspace${state.settingsPanelView === 'styles' ? ' isStylePanel' : ''}">
        <aside class="leftPanel" aria-label="主题与样式设置">
          ${renderSettingsPanelNavigation()}
          ${
            state.settingsPanelView === 'themes'
              ? renderTemplatePanel(visibleTemplateThemes, selectedTheme)
              : renderStyleEditor(editedTheme)
          }
        </aside>

        <section class="editingWorkbench" style="--markdown-pane-width: ${state.markdownPaneWidth}px">
          <section class="editorStage">
            <header class="stageHeader">
              <div class="documentMeta">
                <span class="documentDot" style="background: ${escapeAttribute(selectedTheme.palette.primary)}"></span>
                <div>
                  <span class="stageEyebrow">实时预览 · ${themeAppearanceLabel(state.themeAppearance)}</span>
                  <strong>${escapeHtml(selectedTheme.label)}</strong>
                </div>
              </div>
              <div class="previewSwitch" aria-label="预览尺寸">
                <button
                  type="button"
                  class="${state.previewDevice === 'mobile' ? 'active' : ''}"
                  aria-pressed="${state.previewDevice === 'mobile'}"
                  data-preview-device="mobile"
                >
                  <i class="ti ti-device-mobile"></i><span>手机预览</span>
                </button>
                <button
                  type="button"
                  class="${state.previewDevice === 'desktop' ? 'active' : ''}"
                  aria-pressed="${state.previewDevice === 'desktop'}"
                  data-preview-device="desktop"
                >
                  <i class="ti ti-device-desktop"></i><span>桌面预览</span>
                </button>
              </div>
            </header>

            <div class="articleImageNoticeSlot">
              ${renderArticleImageNotice()}
            </div>

            <div
              class="stageCanvas ${state.previewDevice === 'mobile' ? 'isMobilePreview' : ''}"
              data-article-drop-zone
              ${state.previewRevealPhase !== 'idle' ? 'aria-busy="true"' : ''}
            >
              <div class="dropOverlay" aria-hidden="true">
                <img class="dropMotionMark" src="/moyu-mark-motion.svg" alt="">
                <strong>松开后开始排版</strong>
                <span>Markdown 只在当前页面读取</span>
              </div>
              <div class="previewBoard">
                ${renderedPreview}
              </div>
            </div>
            ${renderPreviewRevealOverlay()}
          </section>

          <div
            class="workbenchDivider"
            role="separator"
            aria-label="调整预览区和编辑区宽度"
            aria-orientation="vertical"
            tabindex="0"
            data-resize-workbench
          ><span aria-hidden="true"></span></div>
          ${renderMarkdownEditorPane()}
        </section>
      </section>

      ${renderMobileThemeDock(selectedTheme)}

      ${state.supportDialogOpen ? renderSupportDialog() : ''}
      ${state.mobileShareDialogOpen ? renderMobileShareDialog() : ''}
      ${state.clipboardConsentDialogOpen ? renderClipboardConsentDialog() : ''}
      ${renderToast()}
    </main>
  `;

  bindEvents();
  mountMarkdownEditor();
  restoreTemplateListScroll();
  restorePreviewReadingPosition();
  centerSelectedMobileTheme();
}

function bindEvents(): void {
  bindArticleSourceEvents();
  bindSupportEvents();
  bindSharingEvents();
  bindClipboardConsentEvents();
  bindSettingsPanelEvents();
  bindMarkdownEditorToolbar();
  bindWorkbenchResize();
  bindPreviewScrollSync();

  const templateList = app.querySelector<HTMLElement>('.templateList');
  templateList?.addEventListener('scroll', () => {
    state.templateListScrollTop = templateList.scrollTop;
  });

  app.querySelectorAll<HTMLButtonElement>('[data-theme-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const themeId = button.dataset.themeId;
      if (!themeId) {
        return;
      }

      if (themeId === state.selectedThemeId || themeId === state.pendingThemeId) {
        return;
      }

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        activateTheme(themeId);
        renderApp();
        return;
      }

      state.pendingThemeId = themeId;
      themeRevealTransition.begin({
        activateTheme: () => activateTheme(themeId),
      });
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-theme-color]').forEach((button) => {
    button.addEventListener('click', () => {
      const colorFilterId = button.dataset.themeColor as ThemeColorFilterId | undefined;
      if (!colorFilterId || colorFilterId === state.themeColorFilterId) {
        return;
      }

      state.themeColorFilterId = colorFilterId;
      state.templateListScrollTop = 0;
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-theme-appearance]').forEach((button) => {
    button.addEventListener('click', () => {
      const appearance = button.dataset.themeAppearance as ThemeAppearance | undefined;
      if (!appearance || appearance === state.themeAppearance) {
        return;
      }

      state.themeAppearance = appearance;
      persistThemeAppearance(appearance);
      reflectThemeSelectionInUrl(state.selectedThemeId, appearance);
      renderApp();
    });
  });

  app.querySelector<HTMLInputElement>('[data-theme-query]')?.addEventListener('input', (event) => {
    state.themeQuery = (event.currentTarget as HTMLInputElement).value;
    state.templateListScrollTop = 0;
    renderApp();
    const queryInput = app.querySelector<HTMLInputElement>('[data-theme-query]');
    queryInput?.focus();
    queryInput?.setSelectionRange(state.themeQuery.length, state.themeQuery.length);
  });

  app.querySelectorAll<HTMLButtonElement>('[data-preview-device]').forEach((button) => {
    button.addEventListener('click', () => {
      const previewDevice = button.dataset.previewDevice as PreviewDevice;
      if (previewDevice === state.previewDevice) {
        return;
      }

      state.previewDevice = previewDevice;
      renderApp();
    });
  });

  app.querySelector<HTMLButtonElement>('[data-copy-article]')?.addEventListener('click', enterWechatCopyFlow);

  app.querySelector<HTMLButtonElement>('[data-toast-action="open-wechat-editor"]')?.addEventListener(
    'click',
    openWechatEditorFromToast,
  );

  app.querySelectorAll<HTMLButtonElement>('[data-editor-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editor.activeTab = button.dataset.editorTab as EditorTab;
      persistEditorState(state.editor);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-text-target]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editor.textTarget = button.dataset.textTarget as TextStyleTarget;
      persistEditorState(state.editor);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-decoration-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const decorationTarget = button.dataset.decorationTarget;
      if (!decorationTarget) {
        return;
      }

      state.editor.decorationTarget = decorationTarget;
      persistEditorState(state.editor);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-style-scope]').forEach((control) => {
    styleControlEventNames({
      tagName: control.tagName,
      inputType: control instanceof HTMLInputElement ? control.type : undefined,
    }).forEach((eventName) => {
      control.addEventListener(eventName, () => {
        updateStyleControl(control);

        if (eventName === 'input') {
          refreshContinuousControlFeedback(control);
          refreshArticlePreview();
          return;
        }

        persistEditorState(state.editor);
        renderApp();
      });
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-style-scope="reset"]').forEach((button) => {
    button.addEventListener('click', () => {
      resetEditorState();
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-align]').forEach((button) => {
    button.addEventListener('click', () => {
      assignTextStyle(state.editor.textTarget, 'text-align', button.dataset.align ?? 'left');
      persistEditorState(state.editor);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-shadow-level]').forEach((button) => {
    button.addEventListener('click', () => {
      const level = button.dataset.shadowLevel as 'none' | 'light' | 'medium' | 'heavy';
      state.editor.overrides.image.figure['box-shadow'] = shadowStyleForLevel(level);
      persistEditorState(state.editor);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-board-pattern]').forEach((button) => {
    button.addEventListener('click', () => {
      const pattern = button.dataset.boardPattern as BoardPattern;
      state.editor.board.pattern = pattern;
      state.editor.board.enabled = pattern !== 'off';
      state.editor.board.size = defaultBoardSize(pattern, state.editor.board.size);
      persistEditorState(state.editor);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-padding-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = button.dataset.paddingPreset;
      if (!preset) {
        return;
      }

      state.editor.overrides.background.container.padding = paddingPresetValue(preset);
      persistEditorState(state.editor);
      renderApp();
    });
  });
}

function bindSettingsPanelEvents(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-settings-panel-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const settingsPanelView = button.dataset.settingsPanelView as SettingsPanelView | undefined;
      if (!settingsPanelView || settingsPanelView === state.settingsPanelView) {
        return;
      }

      state.settingsPanelView = settingsPanelView;
      renderApp();
    });
  });
}

function bindMarkdownEditorToolbar(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-markdown-command]').forEach((button) => {
    button.addEventListener('click', () => {
      const command = button.dataset.markdownCommand as MarkdownEditingCommand | undefined;
      if (command) {
        markdownEditor?.applyEditingCommand(command);
      }
    });
  });

  app.querySelector<HTMLButtonElement>('[data-markdown-history="undo"]')?.addEventListener('click', () => {
    markdownEditor?.undoEditing();
  });
  app.querySelector<HTMLButtonElement>('[data-markdown-history="redo"]')?.addEventListener('click', () => {
    markdownEditor?.redoEditing();
  });
  app.querySelector<HTMLButtonElement>('[data-restore-bundled-article]')?.addEventListener('click', () => {
    if (!window.confirm('恢复示例内容？当前自动保存的编辑内容会被替换。')) {
      return;
    }
    restoreBundledArticle();
  });
}

function bindWorkbenchResize(): void {
  const divider = app.querySelector<HTMLElement>('[data-resize-workbench]');
  const workbench = app.querySelector<HTMLElement>('.editingWorkbench');
  if (!divider || !workbench) {
    return;
  }

  divider.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const originX = event.clientX;
    const originWidth = app.querySelector<HTMLElement>('.markdownEditorPane')?.getBoundingClientRect().width ?? state.markdownPaneWidth;
    divider.setPointerCapture(event.pointerId);
    workbench.classList.add('isResizing');

    const resizeMarkdownPane = (moveEvent: PointerEvent) => {
      state.markdownPaneWidth = constrainMarkdownPaneWidth({
        workbenchWidth: workbench.clientWidth,
        requestedWidth: resizeRightMarkdownPane({
          originPaneWidth: originWidth,
          originPointerX: originX,
          currentPointerX: moveEvent.clientX,
        }),
        dividerWidth: workbenchDividerWidth,
        minimumMarkdownWidth: minimumMarkdownPaneWidth,
        minimumPreviewWidth: minimumPreviewPaneWidth,
      });
      workbench.style.setProperty('--markdown-pane-width', `${state.markdownPaneWidth}px`);
    };

    const concludeResize = () => {
      workbench.classList.remove('isResizing');
      window.removeEventListener('pointermove', resizeMarkdownPane);
      window.removeEventListener('pointerup', concludeResize);
    };

    window.addEventListener('pointermove', resizeMarkdownPane);
    window.addEventListener('pointerup', concludeResize, { once: true });
  });

  divider.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? 1 : -1;
    state.markdownPaneWidth = constrainMarkdownPaneWidth({
      workbenchWidth: workbench.clientWidth,
      requestedWidth: state.markdownPaneWidth + direction * 24,
      dividerWidth: workbenchDividerWidth,
      minimumMarkdownWidth: minimumMarkdownPaneWidth,
      minimumPreviewWidth: minimumPreviewPaneWidth,
    });
    workbench.style.setProperty('--markdown-pane-width', `${state.markdownPaneWidth}px`);
  });
}

function bindPreviewScrollSync(): void {
  const previewSurface = app.querySelector<HTMLElement>('.stageCanvas');
  previewSurface?.addEventListener(
    'scroll',
    () => {
      if (synchronizedScrollSource === 'markdown' || !markdownEditor) {
        return;
      }
      synchronizedScrollSource = 'preview';
      const editorMetrics = markdownEditor.scrollMetrics();
      markdownEditor.scrollTo(
        mapSynchronizedScrollPosition({
          sourceScrollTop: previewSurface.scrollTop,
          sourceScrollHeight: previewSurface.scrollHeight,
          sourceViewportHeight: previewSurface.clientHeight,
          targetScrollHeight: editorMetrics.scrollHeight,
          targetViewportHeight: editorMetrics.viewportHeight,
        }),
      );
      releaseSynchronizedScroll();
    },
    { passive: true },
  );
}

function bindArticleSourceEvents(): void {
  const fileInput = app.querySelector<HTMLInputElement>('#markdownFileInput');
  const articleImageDirectoryInput = app.querySelector<HTMLInputElement>('#articleImageDirectoryInput');
  app.querySelector<HTMLButtonElement>('[data-open-markdown]')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) {
      void previewMarkdownFile(file);
    }
  });
  app.querySelector<HTMLButtonElement>('[data-resolve-article-images]')?.addEventListener('click', () => {
    if (!articleImageDirectoryPickerFallbackRequired && canChooseArticleImageDirectory()) {
      void revealArticleImagesFromDirectoryPicker();
      return;
    }
    articleImageDirectoryInput?.click();
  });
  articleImageDirectoryInput?.addEventListener('change', () => {
    const files = Array.from(articleImageDirectoryInput.files ?? []);
    articleImageDirectoryInput.value = '';
    if (files.length > 0) {
      void revealArticleImagesFromSelectedDirectory(files);
    }
  });

  const dropZone = app.querySelector<HTMLElement>('[data-article-drop-zone]');
  dropZone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('isDragActive');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('isDragActive'));
  dropZone?.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('isDragActive');
    const file = event.dataTransfer?.files[0];
    if (file) {
      void previewMarkdownFile(file);
    }
  });
}

function bindSupportEvents(): void {
  app.querySelector<HTMLButtonElement>('[data-open-support]')?.addEventListener('click', () => {
    dismissToast();
    state.supportDialogOpen = true;
    renderApp();
    app.querySelector<HTMLElement>('.supportDialog')?.focus();
  });

  app.querySelectorAll<HTMLElement>('[data-close-support]').forEach((control) => {
    control.addEventListener('click', () => closeSupportDialog());
  });

  const backdrop = app.querySelector<HTMLElement>('[data-support-backdrop]');
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeSupportDialog();
    }
  });

  app.querySelector<HTMLElement>('.supportDialog')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSupportDialog();
    }
  });
}

function closeSupportDialog(): void {
  state.supportDialogOpen = false;
  renderApp();
  app.querySelector<HTMLButtonElement>('[data-open-support]')?.focus();
}

function bindSharingEvents(): void {
  app.querySelector<HTMLButtonElement>('[data-open-mobile-share]')?.addEventListener('click', () => {
    dismissToast();
    state.mobileShareDialogOpen = true;
    renderApp();
    app.querySelector<HTMLElement>('.mobileShareSheet')?.focus();
  });

  app.querySelectorAll<HTMLElement>('[data-close-mobile-share]').forEach((control) => {
    control.addEventListener('click', () => closeMobileShareDialog());
  });

  const backdrop = app.querySelector<HTMLElement>('[data-mobile-share-backdrop]');
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeMobileShareDialog();
    }
  });

  app.querySelector<HTMLElement>('.mobileShareSheet')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMobileShareDialog();
    }
  });

  app.querySelector<HTMLButtonElement>('[data-share-through-system]')?.addEventListener('click', () => {
    void shareSiteThroughSystem();
  });
  app.querySelector<HTMLButtonElement>('[data-share-to-twitter]')?.addEventListener('click', shareSiteToTwitter);
  app.querySelector<HTMLButtonElement>('[data-copy-share-link]')?.addEventListener('click', () => {
    void copyMobileShareLink();
  });
}

function closeMobileShareDialog(): void {
  state.mobileShareDialogOpen = false;
  renderApp();
  app.querySelector<HTMLButtonElement>('[data-open-mobile-share]')?.focus();
}

function bindClipboardConsentEvents(): void {
  app.querySelectorAll<HTMLElement>('[data-close-clipboard-consent]').forEach((control) => {
    control.addEventListener('click', () => closeClipboardConsentDialog());
  });

  app.querySelector<HTMLButtonElement>('[data-confirm-clipboard-consent]')?.addEventListener('click', () => {
    acceptWechatClipboardConsent();
    state.clipboardConsentDialogOpen = false;
    renderApp();
    void copyCurrentArticleHtml();
  });

  const backdrop = app.querySelector<HTMLElement>('[data-clipboard-consent-backdrop]');
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeClipboardConsentDialog();
    }
  });

  app.querySelector<HTMLElement>('.clipboardConsentDialog')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeClipboardConsentDialog();
    }
  });
}

function closeClipboardConsentDialog(): void {
  state.clipboardConsentDialogOpen = false;
  renderApp();
  app.querySelector<HTMLButtonElement>('[data-copy-article]')?.focus();
}

async function previewMarkdownFile(file: File): Promise<void> {
  if (!supportsMarkdownFile(file)) {
    console.warn(`[theme-preview] opened file rejected name="${file.name}" type="${file.type}" reason="not markdown".`);
    showToast('请选择 .md 或 .markdown 文件');
    return;
  }

  const operation = articlePreparation.begin();
  const revealOperation = articleRevealTransition.begin();

  // 浏览器只在当前页面读取用户明确选择的文件，不上传、不持久化。
  try {
    const markdown = await file.text();
    if (!operation.isCurrent() || !revealOperation.isCurrent()) {
      console.warn(
        `[theme-preview] markdown preview discarded name="${file.name}" reason="a newer article source was selected".`,
      );
      return;
    }

    const diagramResult = await embedArticleDiagramsAsImages({
      markdown,
      renderer: browserArticleDiagramRenderer,
    });
    if (!operation.isCurrent() || !revealOperation.isCurrent()) {
      console.warn(
        `[theme-preview] diagram preview discarded name="${file.name}" reason="a newer article source was selected".`,
      );
      return;
    }

    const articleIdentity: DirectoryArticleIdentity = { fileName: file.name, markdown };
    const preparedArticleImages = await prepareArticleImagesFromRecentDirectory(
      diagramResult.markdown,
      articleIdentity,
    );
    if (!operation.isCurrent() || !revealOperation.isCurrent()) {
      console.warn(
        `[theme-preview] local image preview discarded name="${file.name}" reason="a newer article source was selected".`,
      );
      return;
    }

    revealOperation.revealArticle(() => {
      openedArticleIdentity = articleIdentity;
      state.article = markdownDocumentFromFile({ fileName: file.name, markdown });
      state.previewMarkdown = preparedArticleImages.markdown;
      state.articleImages = preparedArticleImages.resolution;
      resetMarkdownEditorPosition();
      persistCurrentArticleDraft();
      resetPreviewReadingPosition();
      renderApp();
      showToast(articleImportFeedback(`已打开 ${file.name}`, diagramResult, preparedArticleImages));
    });
  } catch (error) {
    console.warn(`[theme-preview] markdown file preparation failed name="${file.name}" reason="${String(error)}".`);
    if (operation.isCurrent() && revealOperation.isCurrent()) {
      revealOperation.cancel();
      showToast('文件读取失败，请重新选择');
    }
  }
}

async function prepareInitialArticlePreview(): Promise<void> {
  const sourceMarkdown = state.article.markdown;
  const previewableMarkdown = state.previewMarkdown;
  const operation = articlePreparation.begin();

  try {
    const diagramResult = await embedArticleDiagramsAsImages({
      markdown: previewableMarkdown,
      renderer: browserArticleDiagramRenderer,
    });
    if (!operation.isCurrent() || state.article.markdown !== sourceMarkdown) {
      console.warn(
        `[moyu-editor] initial article preview discarded file="${state.article.fileName}" reason="article source changed".`,
      );
      return;
    }

    state.previewMarkdown = diagramResult.markdown;
    refreshArticlePreview();
  } catch (error) {
    console.warn(`[moyu-editor] initial article preview preparation failed reason="${String(error)}".`);
  }
}

function pendingArticleImages(markdown: string): PreparedArticleImages {
  const localImages = collectLocalArticleImages(markdown);
  return {
    markdown,
    embeddedImageCount: 0,
    resolution:
      localImages.length > 0
        ? {
            phase: 'permission-required',
            totalImageCount: localImages.length,
            embeddedImageCount: 0,
            unresolvedImages: localImages,
          }
        : null,
  };
}

async function prepareArticleImagesFromRecentDirectory(
  markdown: string,
  articleIdentity: DirectoryArticleIdentity,
): Promise<PreparedArticleImages> {
  const pendingImages = pendingArticleImages(markdown);
  if (!pendingImages.resolution) {
    return pendingImages;
  }

  // 复用历史授权前先确认权限仍然有效，并校验目录中的 Markdown 就是当前文章。
  await recentArticleImageDirectoryReady;
  const directoryHandle = recentArticleImageDirectory;
  if (!directoryHandle) {
    return pendingImages;
  }

  try {
    const permission = await articleImageDirectoryPermission(directoryHandle, false);
    if (permission !== 'granted') {
      console.warn(
        `[theme-preview] remembered article image directory not reused directory="${directoryHandle.name}" permission="${permission}" article="${articleIdentity.fileName}". Keeping ${pendingImages.resolution.totalImageCount} local image placeholders until permission is granted.`,
      );
      return pendingImages;
    }

    const matchesArticle = await directoryContainsOpenedArticle(directoryHandle, articleIdentity);
    if (!matchesArticle) {
      console.warn(
        `[theme-preview] remembered article image directory discarded directory="${directoryHandle.name}" article="${articleIdentity.fileName}" reason="article file missing or content differs". Keeping ${pendingImages.resolution.totalImageCount} local image placeholders.`,
      );
      recentArticleImageDirectory = null;
      await forgetRememberedArticleImageDirectory();
      return pendingImages;
    }

    const embeddingResult = await embedLocalArticleImages({
      markdown,
      source: articleImageSourceFromDirectoryHandle(directoryHandle),
    });
    return preparedArticleImagesFromEmbedding(pendingImages.resolution, embeddingResult);
  } catch (error) {
    console.warn(
      `[theme-preview] remembered article image directory failed directory="${directoryHandle.name}" article="${articleIdentity.fileName}" reason="${String(
        error,
      )}". Keeping ${pendingImages.resolution.totalImageCount} local image placeholders.`,
    );
    return pendingImages;
  }
}

async function revealArticleImagesFromDirectoryPicker(): Promise<void> {
  const currentResolution = state.articleImages;
  if (!currentResolution || currentResolution.phase === 'resolving') {
    return;
  }

  let directoryHandle: FileSystemDirectoryHandle;
  try {
    // 必须直接在点击事件产生的用户激活中打开系统选择器，避免异步操作让授权弹窗被浏览器拦截。
    directoryHandle = await chooseArticleImageDirectory(recentArticleImageDirectory);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    console.warn(`[theme-preview] article image directory selection failed reason="${String(error)}".`);
    articleImageDirectoryPickerFallbackRequired = true;
    showToast('目录授权不可用，请再次点击“显示配图”');
    return;
  }

  const operation = articlePreparation.begin();
  state.articleImages = { ...currentResolution, phase: 'resolving' };
  renderApp();

  try {
    // 文件导入场景必须校验文章身份，防止误用上一次目录中的同名图片。
    if (openedArticleIdentity) {
      const matchesArticle = await directoryContainsOpenedArticle(directoryHandle, openedArticleIdentity);
      if (!matchesArticle) {
        console.warn(
          `[theme-preview] selected article image directory rejected directory="${directoryHandle.name}" article="${openedArticleIdentity.fileName}" reason="article file missing or content differs".`,
        );
        restoreArticleImageResolution(operation, currentResolution);
        showToast(`请选择 ${openedArticleIdentity.fileName} 所在的文件夹`);
        return;
      }
    }

    recentArticleImageDirectory = directoryHandle;
    void rememberSelectedArticleImageDirectory(directoryHandle);
    await revealCurrentArticleImages(
      articleImageSourceFromDirectoryHandle(directoryHandle),
      operation,
      currentResolution,
    );
  } catch (error) {
    console.warn(
      `[theme-preview] selected article image directory failed directory="${directoryHandle.name}" reason="${String(error)}".`,
    );
    restoreArticleImageResolution(operation, currentResolution);
    showToast('读取文章配图失败，请重新选择');
  }
}

async function revealArticleImagesFromSelectedDirectory(files: ReadonlyArray<File>): Promise<void> {
  const currentResolution = state.articleImages;
  if (!currentResolution || currentResolution.phase === 'resolving') {
    return;
  }

  const operation = articlePreparation.begin();
  state.articleImages = { ...currentResolution, phase: 'resolving' };
  renderApp();

  try {
    // 兼容选择器会返回目录内的文件清单，先定位内容完全一致的 Markdown，再建立图片相对路径基准。
    let articleDirectoryPath = '';
    if (openedArticleIdentity) {
      const locatedArticleDirectory = await locateOpenedArticleInSelectedDirectory({
        files,
        fileName: openedArticleIdentity.fileName,
        markdown: openedArticleIdentity.markdown,
      });
      if (locatedArticleDirectory === null) {
        console.warn(
          `[theme-preview] selected article attachment files rejected article="${openedArticleIdentity.fileName}" file_count=${files.length} reason="article file missing or content differs".`,
        );
        restoreArticleImageResolution(operation, currentResolution);
        showToast(`请选择 ${openedArticleIdentity.fileName} 所在的文件夹`);
        return;
      }
      articleDirectoryPath = locatedArticleDirectory;
    }

    await revealCurrentArticleImages(
      articleImageSourceFromSelectedDirectory({ files, articleDirectoryPath }),
      operation,
      currentResolution,
    );
  } catch (error) {
    console.warn(
      `[theme-preview] selected article attachment files failed file_count=${files.length} reason="${String(error)}".`,
    );
    restoreArticleImageResolution(operation, currentResolution);
    showToast('读取文章配图失败，请重新选择');
  }
}

async function revealCurrentArticleImages(
  source: ArticleImageSource,
  operation: ArticlePreparationOperation,
  previousResolution: ArticleImageResolutionState,
): Promise<void> {
  // 每张图片独立解析；成功项立即进入文章，失败项继续保留占位并允许再次选择。
  const embeddingResult = await embedLocalArticleImages({ markdown: state.previewMarkdown, source });
  if (!operation.isCurrent()) {
    console.warn(
      `[theme-preview] resolved article images discarded source="${source.label}" reason="a newer article source was selected".`,
    );
    return;
  }

  const preparedImages = preparedArticleImagesFromEmbedding(previousResolution, embeddingResult);
  state.previewMarkdown = preparedImages.markdown;
  state.articleImages = preparedImages.resolution;
  renderApp();

  if (!preparedImages.resolution) {
    showToast(`${previousResolution.totalImageCount} 张本地配图已全部显示`);
    return;
  }

  showToast(
    `已显示 ${preparedImages.resolution.embeddedImageCount}/${preparedImages.resolution.totalImageCount} 张本地配图`,
  );
}

function preparedArticleImagesFromEmbedding(
  previousResolution: ArticleImageResolutionState,
  result: ArticleImageEmbeddingResult,
): PreparedArticleImages {
  const embeddedImageCount = previousResolution.embeddedImageCount + result.embeddedImageCount;
  return {
    markdown: result.markdown,
    embeddedImageCount: result.embeddedImageCount,
    resolution:
      result.unresolvedImages.length > 0
        ? {
            phase: 'partial',
            totalImageCount: previousResolution.totalImageCount,
            embeddedImageCount,
            unresolvedImages: result.unresolvedImages,
          }
        : null,
  };
}

function restoreArticleImageResolution(
  operation: ArticlePreparationOperation,
  previousResolution: ArticleImageResolutionState,
): void {
  if (!operation.isCurrent()) {
    return;
  }
  state.articleImages = previousResolution;
  renderApp();
}

async function recallRecentArticleImageDirectory(): Promise<void> {
  try {
    const recalledDirectory = await recallArticleImageDirectory();
    if (!recentArticleImageDirectory) {
      recentArticleImageDirectory = recalledDirectory;
    }
  } catch (error) {
    console.warn(
      `[theme-preview] remembered article image directory read failed reason="${String(error)}". Falling back to a new directory selection.`,
    );
    if (!recentArticleImageDirectory) {
      recentArticleImageDirectory = null;
    }
  }
}

async function rememberSelectedArticleImageDirectory(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
  try {
    await rememberArticleImageDirectory(directoryHandle);
  } catch (error) {
    console.warn(
      `[theme-preview] article image directory persistence failed directory="${directoryHandle.name}" reason="${String(
        error,
      )}". Keeping access for the current page only.`,
    );
  }
}

async function forgetRememberedArticleImageDirectory(): Promise<void> {
  try {
    await forgetArticleImageDirectory();
  } catch (error) {
    console.warn(
      `[theme-preview] mismatched article image directory cleanup failed reason="${String(error)}". The invalid handle may be checked again next time.`,
    );
  }
}

function articleImportFeedback(
  prefix: string,
  result: ArticleDiagramEmbeddingResult,
  preparedArticleImages: PreparedArticleImages,
): string {
  let feedback = prefix;
  if (result.failedDiagramCount > 0) {
    feedback += `；${result.failedDiagramCount} 个图表渲染失败，已保留代码`;
  } else if (result.embeddedDiagramCount > 0) {
    feedback += `，${result.embeddedDiagramCount} 个图表已转成图片`;
  }

  if (preparedArticleImages.embeddedImageCount > 0) {
    feedback += `，${preparedArticleImages.embeddedImageCount} 张本地配图已显示`;
  } else if (preparedArticleImages.resolution) {
    feedback += `；检测到 ${preparedArticleImages.resolution.totalImageCount} 张本地配图`;
  }

  return feedback;
}

function activateTheme(themeId: string): void {
  state.selectedThemeId = themeId;
  normalizeDecorationTarget(requireSelectedTheme(dataset.themes, themeId));
  persistSelectedTheme(themeId);
  reflectThemeSelectionInUrl(themeId, state.themeAppearance);
}

function renderArticleImageNotice(): string {
  const articleImages = state.articleImages;
  if (!articleImages) {
    return '';
  }

  if (articleImages.phase === 'resolving') {
    return `
      <section class="articleImageNotice isResolving" role="status" aria-live="polite">
        <i class="ti ti-loader-2" aria-hidden="true"></i>
        <div>
          <strong>正在读取文章配图</strong>
          <span>只处理 Markdown 引用的 ${articleImages.unresolvedImages.length} 个本地文件，图片不会上传。</span>
        </div>
      </section>
    `;
  }

  const isPartial = articleImages.phase === 'partial';
  const title = isPartial
    ? `已显示 ${articleImages.embeddedImageCount}/${articleImages.totalImageCount} 张本地配图`
    : `检测到 ${articleImages.totalImageCount} 张本地配图`;
  const summary = isPartial
    ? `还有 ${articleImages.unresolvedImages.length} 张未找到，可以重新选择文章所在文件夹。`
    : '允许读取文章附件后即可完整预览，图片只在当前浏览器处理。';

  return `
    <section class="articleImageNotice" role="status">
      <i class="ti ti-photo-search" aria-hidden="true"></i>
      <div>
        <strong>${title}</strong>
        <span>${summary}</span>
      </div>
      <button type="button" data-resolve-article-images>
        <i class="ti ti-folder-open" aria-hidden="true"></i>
        <span>${isPartial ? '重新选择' : '显示配图'}</span>
      </button>
    </section>
  `;
}

function renderPreviewRevealOverlay(): string {
  if (state.previewRevealPhase === 'idle') {
    return '';
  }

  if (state.previewRevealPhase === 'brand-loading') {
    const loadingTitle = state.previewRevealContext === 'article' ? '正在载入 Markdown' : '正在打开新主题';
    const loadingSummary = state.previewRevealContext === 'article' ? '正在读取内容与转换图表…' : '准备呈现新的视觉风格…';
    return `
      <div class="themeRevealOverlay isBrandLoading" role="status" aria-live="polite" data-preview-reveal>
        <div class="themeRevealBrand">
          <img src="/moyu-mark-motion.svg" alt="">
          <strong>${loadingTitle}</strong>
          <span>${loadingSummary}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="themeRevealOverlay isCurtainOpening" aria-hidden="true" data-preview-reveal>
      <div class="themeRevealAperture"></div>
    </div>
  `;
}

function refreshContinuousControlFeedback(control: HTMLInputElement | HTMLSelectElement): void {
  if (!(control instanceof HTMLInputElement) || control.type !== 'range') {
    return;
  }

  const displayedValue = control.closest<HTMLElement>('.controlRow')?.querySelector<HTMLInputElement>('.valueInput');
  if (displayedValue) {
    displayedValue.value = `${control.value}${control.dataset.unit ?? ''}`;
  }
}

function refreshArticlePreview(): void {
  const previewBoard = app.querySelector<HTMLElement>('.previewBoard');
  if (!previewBoard) {
    return;
  }

  rememberPreviewReadingPosition();
  const selectedTheme = activeThemeForAppearance();
  const editedTheme = applyThemeStyleOverrides(
    selectedTheme,
    buildPreviewOverrides(state.editor),
    state.editor.decorationPreferences,
  );
  previewBoard.innerHTML = renderPreview(editedTheme);
  restorePreviewReadingPosition();
}

function mountMarkdownEditor(): void {
  const host = app.querySelector<HTMLElement>('[data-markdown-editor]');
  if (!host || window.matchMedia('(max-width: 720px)').matches) {
    return;
  }

  markdownEditor = mountBrowserMarkdownEditor({
    host,
    markdown: state.article.markdown,
    selection: state.markdownSelection,
    scrollTop: state.markdownScrollTop,
    onMarkdownChange: reviseCurrentArticle,
    onScroll: synchronizePreviewFromMarkdown,
  });
}

function rememberMarkdownEditorState(): void {
  if (!markdownEditor) {
    return;
  }
  state.markdownSelection = markdownEditor.selection();
  state.markdownScrollTop = markdownEditor.scrollMetrics().scrollTop;
}

function reviseCurrentArticle(markdown: string): void {
  if (markdown === state.article.markdown) {
    return;
  }

  if (openedArticleIdentity) {
    console.warn(
      `[moyu-editor] opened article identity abandoned file="${openedArticleIdentity.fileName}" reason="markdown was edited". Reusing any granted image directory for the edited article.`,
    );
    openedArticleIdentity = null;
  }

  state.article = { ...state.article, markdown };
  state.previewMarkdown = markdown;
  state.articleImages = state.article.source === 'demo' ? null : pendingArticleImages(markdown).resolution;
  state.articleDraftSavePhase = 'saving';
  refreshArticlePreview();
  refreshArticleImageNotice();
  refreshMarkdownEditorMeta();
  scheduleArticleDraftPersistence();
  scheduleEditedArticlePreparation(markdown);
}

function scheduleArticleDraftPersistence(): void {
  window.clearTimeout(articleDraftSaveTimer);
  articleDraftSaveTimer = window.setTimeout(() => {
    state.articleDraftSavePhase = persistCurrentArticleDraft() ? 'saved' : 'failed';
    refreshMarkdownEditorMeta();
  }, 320);
}

function persistCurrentArticleDraft(): boolean {
  try {
    window.localStorage.setItem(articleDraftStorageKey, serializeArticleDraft(state.article));
    state.articleDraftSavePhase = 'saved';
    return true;
  } catch (error) {
    console.warn(
      `[moyu-editor] article draft persistence failed file="${state.article.fileName}" characters=${state.article.markdown.length} reason="${String(
        error,
      )}". Keeping the edited article in memory only.`,
    );
    state.articleDraftSavePhase = 'failed';
    return false;
  }
}

function scheduleEditedArticlePreparation(markdown: string): void {
  window.clearTimeout(editedArticlePreparationTimer);
  const operation = articlePreparation.begin();
  editedArticlePreparationTimer = window.setTimeout(() => {
    void prepareEditedArticlePreview(markdown, operation);
  }, 560);
}

async function prepareEditedArticlePreview(
  sourceMarkdown: string,
  operation: ArticlePreparationOperation,
): Promise<void> {
  try {
    const previewableMarkdown = prepareBundledArticleImages({ ...state.article, markdown: sourceMarkdown });
    const diagramResult = await embedArticleDiagramsAsImages({
      markdown: previewableMarkdown,
      renderer: browserArticleDiagramRenderer,
    });
    let preparedImages = pendingArticleImages(diagramResult.markdown);

    await recentArticleImageDirectoryReady;
    const directoryHandle = recentArticleImageDirectory;
    if (preparedImages.resolution && directoryHandle) {
      const permission = await articleImageDirectoryPermission(directoryHandle, false);
      if (permission === 'granted') {
        const embeddingResult = await embedLocalArticleImages({
          markdown: diagramResult.markdown,
          source: articleImageSourceFromDirectoryHandle(directoryHandle),
        });
        preparedImages = preparedArticleImagesFromEmbedding(preparedImages.resolution, embeddingResult);
      }
    }

    if (!operation.isCurrent() || state.article.markdown !== sourceMarkdown) {
      console.warn(
        `[moyu-editor] edited article preview discarded file="${state.article.fileName}" reason="newer markdown is active".`,
      );
      return;
    }

    state.previewMarkdown = preparedImages.markdown;
    state.articleImages = preparedImages.resolution;
    refreshArticlePreview();
    refreshArticleImageNotice();
  } catch (error) {
    if (!operation.isCurrent()) {
      console.warn(
        `[moyu-editor] stale article preview preparation failed and was ignored file="${state.article.fileName}" reason="${String(
          error,
        )}" decision="a newer markdown preparation is active".`,
      );
      return;
    }
    console.warn(
      `[moyu-editor] edited article preview preparation failed file="${state.article.fileName}" reason="${String(
        error,
      )}". Keeping the immediate Markdown preview.`,
    );
  }
}

function refreshArticleImageNotice(): void {
  const noticeSlot = app.querySelector<HTMLElement>('.articleImageNoticeSlot');
  if (noticeSlot) {
    noticeSlot.innerHTML = renderArticleImageNotice();
    noticeSlot.querySelector<HTMLButtonElement>('[data-resolve-article-images]')?.addEventListener('click', () => {
      if (!articleImageDirectoryPickerFallbackRequired && canChooseArticleImageDirectory()) {
        void revealArticleImagesFromDirectoryPicker();
        return;
      }
      app.querySelector<HTMLInputElement>('#articleImageDirectoryInput')?.click();
    });
  }
}

function refreshMarkdownEditorMeta(): void {
  const characterCount = app.querySelector<HTMLElement>('[data-article-character-count]');
  if (characterCount) {
    characterCount.textContent = `${articleCharacterCount(state.article.markdown)} 字`;
  }
  const saveStatus = app.querySelector<HTMLElement>('[data-draft-save-status]');
  if (saveStatus) {
    saveStatus.className = `draftSaveStatus is${capitalize(state.articleDraftSavePhase)}`;
    saveStatus.textContent = articleDraftSaveLabel(state.articleDraftSavePhase);
  }
}

function synchronizePreviewFromMarkdown(metrics: MarkdownEditorScrollMetrics): void {
  state.markdownScrollTop = metrics.scrollTop;
  if (synchronizedScrollSource === 'preview') {
    return;
  }
  const previewSurface = app.querySelector<HTMLElement>('.stageCanvas');
  if (!previewSurface) {
    return;
  }

  synchronizedScrollSource = 'markdown';
  previewSurface.scrollTop = mapSynchronizedScrollPosition({
    sourceScrollTop: metrics.scrollTop,
    sourceScrollHeight: metrics.scrollHeight,
    sourceViewportHeight: metrics.viewportHeight,
    targetScrollHeight: previewSurface.scrollHeight,
    targetViewportHeight: previewSurface.clientHeight,
  });
  releaseSynchronizedScroll();
}

function releaseSynchronizedScroll(): void {
  if (synchronizedScrollFrame !== undefined) {
    window.cancelAnimationFrame(synchronizedScrollFrame);
  }
  synchronizedScrollFrame = window.requestAnimationFrame(() => {
    synchronizedScrollSource = null;
  });
}

function rememberTemplateListScroll(): void {
  const templateList = app.querySelector<HTMLElement>('.templateList');
  if (!templateList) {
    return;
  }

  state.templateListScrollTop = templateList.scrollTop;
}

function restoreTemplateListScroll(): void {
  const templateList = app.querySelector<HTMLElement>('.templateList');
  if (!templateList) {
    return;
  }

  templateList.scrollTop = state.templateListScrollTop;
}

function rememberPreviewReadingPosition(): void {
  if (state.previewReadingPositionShouldReset) {
    return;
  }

  const readingSurface = resolvePreviewReadingSurface();
  if (!readingSurface) {
    return;
  }

  // 两端都以“当前可见内容块 + 块内进度”记录阅读位置，滚动容器差异由 reading surface 收敛。
  state.previewScrollTop = readingSurface.scrollTop;
  state.previewScrollLeft = readingSurface.scrollLeft;
  const readingBlocks = [...readingSurface.root.querySelectorAll<HTMLElement>('[data-reading-anchor]')].map(
    (block): PreviewReadingBlockGeometry => {
      const blockBounds = block.getBoundingClientRect();
      return {
        anchorId: block.dataset.readingAnchor ?? '',
        topOffset: blockBounds.top - readingSurface.viewportTop,
        height: blockBounds.height,
      };
    },
  );
  state.previewReadingAnchor = locateCurrentReadingAnchor({
    viewportHeight: readingSurface.viewportHeight,
    blocks: readingBlocks,
  });
}

function restorePreviewReadingPosition(): void {
  const scrollTop = state.previewReadingPositionShouldReset ? 0 : state.previewScrollTop;
  const scrollLeft = state.previewReadingPositionShouldReset ? 0 : state.previewScrollLeft;
  const readingAnchor = state.previewReadingPositionShouldReset ? null : state.previewReadingAnchor;
  state.previewReadingPositionShouldReset = false;

  const restore = () => {
    const readingSurface = resolvePreviewReadingSurface();
    if (!readingSurface) {
      return;
    }

    readingSurface.restoreScroll({ top: scrollTop, left: scrollLeft });
    if (!readingAnchor) {
      return;
    }

    // 主题改变块高度后，回到同一内容块的同一阅读进度，而不是沿用失真的绝对像素位置。
    const targetBlock = [...readingSurface.root.querySelectorAll<HTMLElement>('[data-reading-anchor]')].find(
      (block) => block.dataset.readingAnchor === readingAnchor.anchorId,
    );
    if (!targetBlock) {
      console.warn(
        `[theme-preview] reading anchor unavailable anchor="${readingAnchor.anchorId}". Falling back to scrollTop=${scrollTop}.`,
      );
      return;
    }

    const targetBounds = targetBlock.getBoundingClientRect();
    const adjustment = calculateReadingAnchorScrollAdjustment({
      anchor: readingAnchor,
      targetBlock: {
        anchorId: readingAnchor.anchorId,
        topOffset: targetBounds.top - readingSurface.viewportTop,
        height: targetBounds.height,
      },
    });
    readingSurface.advanceScroll(adjustment);
  };

  restore();
  if (previewPositionRestoreFrame !== undefined) {
    window.cancelAnimationFrame(previewPositionRestoreFrame);
  }
  previewPositionRestoreFrame = window.requestAnimationFrame(restore);
}

function resolvePreviewReadingSurface(): PreviewReadingSurface | null {
  if (isMobileReadingLayout()) {
    return resolveMobileReadingSurface();
  }

  const stageCanvas = app.querySelector<HTMLElement>('.stageCanvas');
  if (!stageCanvas) {
    return null;
  }

  const stageBounds = stageCanvas.getBoundingClientRect();
  return {
    root: stageCanvas,
    viewportTop: stageBounds.top,
    viewportHeight: stageCanvas.clientHeight,
    scrollTop: stageCanvas.scrollTop,
    scrollLeft: stageCanvas.scrollLeft,
    restoreScroll: ({ top, left }) => {
      stageCanvas.scrollTo({ top, left, behavior: 'instant' });
    },
    advanceScroll: (distance) => {
      stageCanvas.scrollTop += distance;
    },
  };
}

function resolveMobileReadingSurface(): PreviewReadingSurface {
  const commandBarBounds = app.querySelector<HTMLElement>('.commandBar')?.getBoundingClientRect();
  const themeDockBounds = app.querySelector<HTMLElement>('.mobileThemeDock')?.getBoundingClientRect();
  // 吸顶栏和浮动主题栏会遮住文章，这部分不能计入移动端的真实阅读视口。
  const readingViewport = calculateUnobstructedReadingViewport({
    viewportTop: 0,
    viewportBottom: window.innerHeight,
    topObstructionBottom: commandBarBounds && commandBarBounds.height > 0 ? commandBarBounds.bottom : undefined,
    bottomObstructionTop: themeDockBounds && themeDockBounds.height > 0 ? themeDockBounds.top : undefined,
  });

  return {
    root: app,
    viewportTop: readingViewport.top,
    viewportHeight: readingViewport.height,
    scrollTop: window.scrollY,
    scrollLeft: window.scrollX,
    restoreScroll: ({ top, left }) => {
      window.scrollTo({ top, left, behavior: 'instant' });
    },
    advanceScroll: (distance) => {
      window.scrollBy({ top: distance, left: 0, behavior: 'instant' });
    },
  };
}

function resetPreviewReadingPosition(): void {
  state.previewScrollTop = 0;
  state.previewScrollLeft = 0;
  state.previewReadingAnchor = null;
  state.previewReadingPositionShouldReset = true;
}

function isMobileReadingLayout(): boolean {
  return window.matchMedia('(max-width: 720px)').matches;
}

function centerSelectedMobileTheme(): void {
  if (!isMobileReadingLayout()) {
    return;
  }

  const themeRail = app.querySelector<HTMLElement>('.mobileThemeRail');
  const selectedTheme = themeRail?.querySelector<HTMLElement>('[aria-current="true"]');
  if (!themeRail || !selectedTheme) {
    return;
  }

  themeRail.scrollLeft = selectedTheme.offsetLeft - (themeRail.clientWidth - selectedTheme.clientWidth) / 2;
}

function renderMarkdownEditorPane(): string {
  return `
    <section class="markdownEditorPane" aria-label="Markdown 在线编辑">
      <input id="markdownFileInput" class="visuallyHidden" type="file" accept=".md,.markdown,text/markdown">
      <input id="articleImageDirectoryInput" class="visuallyHidden" type="file" webkitdirectory multiple>
      <header class="markdownPaneHeader">
        <div>
          <strong>Markdown</strong>
          <span>${escapeHtml(articleDisplayFileName(state.article))}</span>
        </div>
        <div class="markdownPaneStatus">
          <span data-article-character-count>${articleCharacterCount(state.article.markdown)} 字</span>
          <span class="draftSaveStatus is${capitalize(state.articleDraftSavePhase)}" data-draft-save-status>
            ${articleDraftSaveLabel(state.articleDraftSavePhase)}
          </span>
          <button type="button" data-open-markdown title="导入 Markdown 文件">
            <i class="ti ti-file-upload"></i><span>导入</span>
          </button>
          <button type="button" data-restore-bundled-article title="恢复示例内容">
            <i class="ti ti-restore"></i><span>恢复示例</span>
          </button>
        </div>
      </header>
      <div class="markdownToolbar" role="toolbar" aria-label="Markdown 格式工具">
        ${renderMarkdownToolbarButton('heading-1', 'ti-h-1', '一级标题')}
        ${renderMarkdownToolbarButton('heading-2', 'ti-h-2', '二级标题')}
        ${renderMarkdownToolbarButton('heading-3', 'ti-h-3', '三级标题')}
        <span class="markdownToolbarDivider" aria-hidden="true"></span>
        ${renderMarkdownToolbarButton('bold', 'ti-bold', '加粗')}
        ${renderMarkdownToolbarButton('italic', 'ti-italic', '斜体')}
        ${renderMarkdownToolbarButton('inline-code', 'ti-code', '行内代码')}
        ${renderMarkdownToolbarButton('blockquote', 'ti-blockquote', '引用')}
        <span class="markdownToolbarDivider" aria-hidden="true"></span>
        ${renderMarkdownToolbarButton('unordered-list', 'ti-list', '无序列表')}
        ${renderMarkdownToolbarButton('ordered-list', 'ti-list-numbers', '有序列表')}
        ${renderMarkdownToolbarButton('task-list', 'ti-list-check', '任务列表')}
        ${renderMarkdownToolbarButton('code-block', 'ti-code-dots', '代码块')}
        ${renderMarkdownToolbarButton('table', 'ti-table', '表格')}
        ${renderMarkdownToolbarButton('link', 'ti-link', '链接')}
        ${renderMarkdownToolbarButton('horizontal-rule', 'ti-separator-horizontal', '分割线')}
        <span class="markdownToolbarDivider" aria-hidden="true"></span>
        <button type="button" data-markdown-history="undo" aria-label="撤销" title="撤销">
          <i class="ti ti-arrow-back-up"></i>
        </button>
        <button type="button" data-markdown-history="redo" aria-label="重做" title="重做">
          <i class="ti ti-arrow-forward-up"></i>
        </button>
      </div>
      <div class="markdownEditorHost" data-markdown-editor></div>
    </section>
  `;
}

function renderMarkdownToolbarButton(command: MarkdownEditingCommand, icon: string, label: string): string {
  return `
    <button type="button" data-markdown-command="${command}" aria-label="${label}" title="${label}">
      <i class="ti ${icon}"></i>
    </button>
  `;
}

function renderSettingsPanelNavigation(): string {
  return `
    <div class="settingsPanelTabs" role="tablist" aria-label="主题与样式">
      <button
        type="button"
        role="tab"
        class="${state.settingsPanelView === 'themes' ? 'active' : ''}"
        aria-selected="${state.settingsPanelView === 'themes'}"
        data-settings-panel-view="themes"
      >主题</button>
      <button
        type="button"
        role="tab"
        class="${state.settingsPanelView === 'styles' ? 'active' : ''}"
        aria-selected="${state.settingsPanelView === 'styles'}"
        data-settings-panel-view="styles"
      >样式</button>
    </div>
  `;
}

function renderTemplatePanel(themes: ThemeDefinition[], selectedTheme: ThemeDefinition): string {
  return `
    ${renderThemeAppearanceSwitch('themeAppearanceSwitch')}
    <div class="themeColorTabs" aria-label="主题色调">
      ${themeColorFilters
        .map((colorFilter) => renderThemeColorButton(colorFilter.id, colorFilter.label))
        .join('')}
    </div>
    <label class="themeSearch">
      <i class="ti ti-search"></i>
      <input
        type="search"
        value="${escapeAttribute(state.themeQuery)}"
        aria-label="搜索主题名称"
        placeholder="搜索主题名称"
        data-theme-query
      >
    </label>
    <nav class="templateList" aria-label="可用模板">
      ${
        themes.length > 0
          ? themes.map((theme) => renderThemeTemplateCard(theme, selectedTheme)).join('')
          : '<p class="emptyThemeResult">没有匹配的主题，换个关键词试试。</p>'
      }
    </nav>
    <div class="creatorFooter">
      <a href="${githubRepositoryUrl}" target="_blank" rel="noopener noreferrer" title="查看 GitHub 开源仓库">
        <i class="ti ti-brand-github"></i><span>GitHub</span>
      </a>
      <button type="button" data-open-support>
        <i class="ti ti-coffee"></i><span>支持作者</span>
      </button>
    </div>
  `;
}

function renderThemeAppearanceSwitch(className: string): string {
  return `
    <div class="${className}" role="group" aria-label="主题明暗外观">
      <button
        type="button"
        class="${state.themeAppearance === 'light' ? 'active' : ''}"
        aria-pressed="${state.themeAppearance === 'light'}"
        data-theme-appearance="light"
        title="切换为亮色外观"
      ><i class="ti ti-sun"></i><span>亮色</span></button>
      <button
        type="button"
        class="${state.themeAppearance === 'dark' ? 'active' : ''}"
        aria-pressed="${state.themeAppearance === 'dark'}"
        data-theme-appearance="dark"
        title="切换为暗色外观"
      ><i class="ti ti-moon"></i><span>暗色</span></button>
    </div>
  `;
}

function renderThemeColorButton(colorFilterId: ThemeColorFilterId, label: string): string {
  return `
    <button
      type="button"
      class="${state.themeColorFilterId === colorFilterId ? 'active' : ''}"
      aria-pressed="${state.themeColorFilterId === colorFilterId}"
      data-theme-color="${colorFilterId}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function renderThemeTemplateCard(theme: ThemeDefinition, selectedTheme: ThemeDefinition): string {
  const themeId = theme.value || theme.id;
  const isSelected = themeId === (selectedTheme.value || selectedTheme.id);
  const paletteSurface = resolveThemeAppearancePreview(theme, state.themeAppearance);
  const colorLabels = theme.palette.colorFamilies
    .map((colorFamily) => themeColorFilters.find((filter) => filter.id === colorFamily)?.label)
    .filter((label): label is string => Boolean(label))
    .join('、');

  return `
    <button
      class="templateCard${isSelected ? ' isSelected' : ''}"
      type="button"
      data-theme-id="${escapeAttribute(themeId)}"
      aria-label="使用${escapeAttribute(theme.label)}主题，外观：${themeAppearanceLabel(state.themeAppearance)}，色调：${escapeAttribute(colorLabels)}"
      aria-current="${isSelected ? 'true' : 'false'}"
      title="${escapeAttribute(theme.label)}"
    >
      <span class="templatePalette" style="background: ${escapeAttribute(paletteSurface.background)}" aria-hidden="true">
        <strong style="color: ${escapeAttribute(paletteSurface.foreground)}">Aa</strong>
        <i class="palettePrimary" style="background: ${escapeAttribute(paletteSurface.primary)}"></i>
        <i class="paletteSecondary" style="background: ${escapeAttribute(paletteSurface.secondary)}"></i>
        <i class="paletteNeutral" style="background: ${escapeAttribute(paletteSurface.foreground)}"></i>
      </span>
      <span class="templateName">${escapeHtml(theme.label)}</span>
      <span class="templateSelectionMark" aria-hidden="true"><i class="ti ti-check"></i></span>
    </button>
  `;
}

function renderMobileThemeDock(selectedTheme: ThemeDefinition): string {
  const selectedThemeId = selectedTheme.value || selectedTheme.id;

  return `
    <nav class="mobileThemeDock" aria-label="切换文章主题">
      <header>
        <span class="mobileThemeMark"><img src="/moyu-mark.svg" alt="" aria-hidden="true"></span>
        <span>
          <small>当前主题</small>
          <strong>${escapeHtml(selectedTheme.label)}</strong>
        </span>
        ${renderThemeAppearanceSwitch('mobileAppearanceSwitch')}
      </header>
      <div class="mobileThemeRail">
        ${dataset.themes
          .map((theme) => {
            const themeId = theme.value || theme.id;
            const isSelected = themeId === selectedThemeId;
            const palette = resolveThemeAppearancePreview(theme, state.themeAppearance);
            return `
              <button
                type="button"
                data-theme-id="${escapeAttribute(themeId)}"
                aria-current="${isSelected ? 'true' : 'false'}"
              >
                <i style="background: ${escapeAttribute(palette.primary)}"></i>
                <span>${escapeHtml(theme.label)}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    </nav>
  `;
}

function renderPreview(editedTheme: ThemeDefinition): string {
  const result = renderThemeMarkdown({ markdown: state.previewMarkdown, theme: editedTheme, readingAnchors: true });
  return `<div class="articleFrame">${result.html}</div>`;
}

function renderStyleEditor(editedTheme: ThemeDefinition): string {
  return `
    <div class="settingsHeader">
      <div>
        <span class="panelEyebrow">当前主题 · ${themeAppearanceLabel(state.themeAppearance)}</span>
        <h2>${escapeHtml(editedTheme.label)}</h2>
      </div>
      <div class="styleSettingsActions">
        <button class="resetStyleButton" type="button" data-style-scope="reset" data-style-key="all">
          <i class="ti ti-refresh"></i><span>重置</span>
        </button>
      </div>
    </div>
    <div class="editorTabs" role="tablist" aria-label="样式类型">
      ${editorTabs
        .map(
          (tab) => `
            <button
              type="button"
              role="tab"
              class="${state.editor.activeTab === tab.id ? 'active' : ''}"
              aria-selected="${state.editor.activeTab === tab.id}"
              data-editor-tab="${tab.id}"
            >
              <i class="ti ${tab.icon}"></i>
              <strong>${tab.label}</strong>
            </button>
          `,
        )
        .join('')}
    </div>
    <div class="editorBody">
      ${renderEditorBody(editedTheme)}
    </div>
  `;
}

function renderSupportDialog(): string {
  return `
    <div class="dialogBackdrop supportBackdrop" role="presentation" data-support-backdrop>
      <section
        class="supportDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supportDialogTitle"
        tabindex="-1"
      >
        <header>
          <div>
            <h2 id="supportDialogTitle">请作者喝杯咖啡</h2>
            <p>谢谢你愿意支持墨鱼排版。它会继续免费、开源，也会慢慢变得更好。</p>
          </div>
          <button class="dialogClose" type="button" data-close-support aria-label="关闭">
            <i class="ti ti-x"></i>
          </button>
        </header>
        <div class="supportQrGrid">
          <figure>
            <img src="/support-alipay.png" alt="支付宝收款码">
            <figcaption><i class="ti ti-brand-alipay"></i><span>支付宝</span></figcaption>
          </figure>
          <figure>
            <img src="/support-wechat.png" alt="微信收款码">
            <figcaption><i class="ti ti-brand-wechat"></i><span>微信支付</span></figcaption>
          </figure>
        </div>
        <footer class="supportDialogFooter">
          <p>量力随缘，不支持也完全没关系。谢谢你愿意让这个小工具继续慢慢变好。</p>
          <a href="${creatorSiteUrl}" target="_blank" rel="noopener noreferrer">
            <span>去「了不起的人」看看其他作品</span><i class="ti ti-arrow-up-right"></i>
          </a>
        </footer>
      </section>
    </div>
  `;
}

function renderMobileShareDialog(): string {
  return `
    <div class="dialogBackdrop mobileShareBackdrop" role="presentation" data-mobile-share-backdrop>
      <section
        class="mobileShareSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobileShareTitle"
        tabindex="-1"
      >
        <header>
          <div>
            <h2 id="mobileShareTitle">分享墨鱼排版</h2>
            <p>把这个免费开源的小工具转给有需要的朋友。</p>
          </div>
          <button type="button" data-close-mobile-share aria-label="关闭分享面板">
            <i class="ti ti-x"></i>
          </button>
        </header>
        <div class="mobileShareOptions">
          <button type="button" data-share-through-system>
            <i class="ti ti-share-3"></i>
            <span><strong>系统分享</strong><small>微信、信息等</small></span>
          </button>
          <button type="button" data-share-to-twitter>
            <i class="ti ti-brand-x"></i>
            <span><strong>Twitter / X</strong><small>发布分享链接</small></span>
          </button>
          <button type="button" data-copy-share-link>
            <i class="ti ti-link"></i>
            <span><strong>复制链接</strong><small>分享不可用时使用</small></span>
          </button>
        </div>
        <p class="mobileShareHint">iOS 与 Android 会打开系统分享面板；微信内请使用右上角转发。</p>
      </section>
    </div>
  `;
}

function renderClipboardConsentDialog(): string {
  return `
    <div class="dialogBackdrop clipboardConsentBackdrop" role="presentation" data-clipboard-consent-backdrop>
      <section
        class="clipboardConsentDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clipboardConsentTitle"
        tabindex="-1"
      >
        <header>
          <span class="clipboardConsentIcon"><i class="ti ti-clipboard-check"></i></span>
          <div>
            <h2 id="clipboardConsentTitle">复制排版内容</h2>
            <p>接下来会复制排版后的内容，方便你粘贴到微信公众号草稿箱。</p>
          </div>
        </header>
        <footer>
          <button class="dialogCancel" type="button" data-close-clipboard-consent>取消</button>
          <button class="dialogConfirm" type="button" data-confirm-clipboard-consent>
            <i class="ti ti-copy-check"></i><span>复制内容</span>
          </button>
        </footer>
      </section>
    </div>
  `;
}

function renderToast(): string {
  if (!state.toast) {
    return '';
  }

  return `
    <div class="toast${state.toast.action ? ' hasAction' : ''}" role="status">
      <span>${escapeHtml(state.toast.message)}</span>
      ${
        state.toast.action
          ? `<button type="button" data-toast-action="${state.toast.action}">${escapeHtml(state.toast.actionLabel ?? '')}<i class="ti ti-arrow-up-right"></i></button>`
          : ''
      }
    </div>
  `;
}

function renderEditorBody(editedTheme: ThemeDefinition): string {
  switch (state.editor.activeTab) {
    case 'text':
      return renderTextEditor(editedTheme);
    case 'image':
      return renderImageEditor(editedTheme);
    case 'background':
      return renderBackgroundEditor(editedTheme);
    case 'decoration':
      return renderDecorationEditor(editedTheme);
    case 'board':
      return renderBoardEditor();
  }
}

function renderTextEditor(theme: ThemeDefinition): string {
  const targetStyle = theme.config?.block?.[state.editor.textTarget] ?? {};
  const strongStyle = theme.config?.inline?.strong ?? {};

  return `
    <div class="chipGrid">
      ${textTargets
        .map(
          (target) => `
            <button type="button" class="${state.editor.textTarget === target.id ? 'active' : ''}" data-text-target="${target.id}">
              ${target.label}
            </button>
          `,
        )
        .join('')}
    </div>
    <section class="settingCard">
      ${renderColorControl('文字颜色', 'text', 'color', stringStyle(targetStyle.color, '#4A4A45'))}
      ${renderRangeControl('字号', 'text', 'font-size', numericStyle(targetStyle['font-size'], 15), 10, 40, 1, 'px')}
      ${renderSelectControl('粗细', 'text', 'font-weight', stringStyle(targetStyle['font-weight'], '400'), [
        ['300', '细体'],
        ['400', '正常'],
        ['600', '半粗'],
        ['700', '粗体'],
        ['800', '特粗'],
      ])}
      ${renderRangeControl('字间距', 'text', 'letter-spacing', numericStyle(targetStyle['letter-spacing'], 0), 0, 2, 0.01, 'px')}
      ${renderRangeControl('行高', 'text', 'line-height', numericStyle(targetStyle['line-height'], 1.8), 1, 3, 0.01, '')}
      ${renderAlignControl(stringStyle(targetStyle['text-align'], 'left'))}
      ${renderRangeControl('下边距', 'text', 'margin-bottom', numericStyle(targetStyle['margin-bottom'], 16), 0, 80, 1, 'px')}
    </section>
    <section class="settingCard">
      <h3>加粗字体样式</h3>
      ${renderSelectControl('字体粗细', 'strong', 'font-weight', stringStyle(strongStyle['font-weight'], '700'), [
        ['600', '半粗'],
        ['700', '粗体'],
        ['800', '特粗'],
      ])}
      ${renderColorControl('文字颜色', 'strong', 'color', normalizeColorValue(stringStyle(strongStyle.color, '#000000')))}
      ${renderTextControl('背景颜色', 'strong', 'background', stringStyle(strongStyle.background, 'transparent'))}
    </section>
  `;
}

function renderImageEditor(theme: ThemeDefinition): string {
  const imageStyle = theme.config?.block?.image ?? {};
  const figureStyle = theme.config?.block?.figure ?? {};
  const captionStyle = theme.config?.block?.figcaption ?? {};

  return `
    <section class="editorSection">
      <h3>图片样式</h3>
      <div class="settingCard">
        ${renderRangeControl('最大宽度', 'image.image', 'max-width', numericStyle(imageStyle['max-width'], 100), 40, 100, 1, '%')}
        ${renderRangeControl('圆角', 'image.image', 'border-radius', numericStyle(imageStyle['border-radius'], 8), 0, 40, 1, 'px')}
        <div class="controlRow">
          <span>阴影</span>
          <div class="buttonGroup">
            ${['none', 'light', 'medium', 'heavy']
              .map((level) => `<button type="button" data-shadow-level="${level}">${shadowLabel(level)}</button>`)
              .join('')}
          </div>
        </div>
      </div>
    </section>
    <section class="editorSection">
      <h3>图片说明</h3>
      <div class="settingCard">
        ${renderToggleControl('显示说明文本', 'image.figcaption', 'display', stringStyle(captionStyle.display, 'block') !== 'none')}
        ${renderColorControl('颜色', 'image.figcaption', 'color', normalizeColorValue(stringStyle(captionStyle.color, '#6B6B6B')))}
        ${renderRangeControl('字号', 'image.figcaption', 'font-size', numericStyle(captionStyle['font-size'], 12), 10, 20, 1, 'px')}
        ${renderSelectControl('对齐', 'image.figcaption', 'text-align', stringStyle(captionStyle['text-align'], 'center'), [
          ['left', '左对齐'],
          ['center', '居中'],
          ['right', '右对齐'],
        ])}
      </div>
    </section>
    <section class="editorSection">
      <h3>间距设置</h3>
      <div class="settingCard">
        ${renderRangeControl('下边距', 'image.figure', 'margin-bottom', numericStyle(figureStyle['margin-bottom'], 32), 0, 80, 1, 'px')}
      </div>
    </section>
  `;
}

function renderBackgroundEditor(theme: ThemeDefinition): string {
  const containerStyle = theme.config?.block?.container ?? {};

  return `
    <section class="settingCard">
      ${renderColorControl('背景颜色', 'background.container', 'background-color', normalizeColorValue(stringStyle(containerStyle['background-color'], '#FFFFFF')))}
    </section>
    <section class="editorSection">
      <h3>内边距</h3>
      <div class="settingCard">
        <div class="presetGrid">
          ${['none', 'tight', 'medium', 'loose', 'wide']
            .map((preset) => `<button type="button" data-padding-preset="${preset}">${paddingPresetLabel(preset)}</button>`)
            .join('')}
        </div>
        ${renderTextControl('整体', 'background.container', 'padding', stringStyle(containerStyle.padding, '0.5rem 1rem'))}
      </div>
    </section>
    <section class="editorSection">
      <h3>外边距</h3>
      <div class="settingCard">
        ${renderTextControl('整体', 'background.container', 'margin', stringStyle(containerStyle.margin, '0 auto'))}
      </div>
    </section>
  `;
}

function renderDecorationEditor(theme: ThemeDefinition): string {
  const targets = decorationTargets(theme);
  const activeTarget = state.editor.decorationTarget || targets[0]?.componentName || '';
  const activeRule = targets.find((target) => target.componentName === activeTarget);
  const component = theme.config?.components?.[activeTarget];
  const previewTemplate = component?.template ?? (activeRule?.variant ? component?.variants?.[activeRule.variant]?.template : undefined);
  const colorEntries = listEditableDecorationColorFields(component?.style ?? {});
  const preview = renderDecorationPreview(previewTemplate ?? '', component?.style ?? {});

  return `
    <div class="chipGrid">
      ${targets
        .map(
          (target) => `
            <button type="button" class="${activeTarget === target.componentName ? 'active' : ''}" data-decoration-target="${escapeAttribute(target.componentName)}">
              ${escapeHtml(target.label)}
            </button>
          `,
        )
        .join('')}
    </div>
    ${
      activeRule?.ruleKey === 'section_divider'
        ? `<section class="settingCard decorationEnable">
            <strong>显示章节分隔符</strong>
            ${renderToggleControl('', 'decoration-settings', 'sectionDividerEnabled', state.editor.decorationPreferences.sectionDividerEnabled)}
          </section>`
        : ''
    }
    <section class="decorationPreview">
      <span>预览效果</span>
      ${preview || '<p>当前装饰无模板预览</p>'}
    </section>
    <section class="editorSection">
      <h3>装饰属性</h3>
      <div class="settingCard">
        ${
          colorEntries.length > 0
            ? colorEntries
                .map(({ key, value }) =>
                  renderColorControl(decorationFieldLabel(key), `decoration.${activeTarget}`, key, normalizeColorValue(String(value))),
                )
                .join('')
            : '<p class="emptyHint">当前装饰没有可直接编辑的颜色变量。</p>'
        }
      </div>
    </section>
  `;
}

function renderBoardEditor(): string {
  const board = state.editor.board;

  return `
    <section class="settingCard boardEnable">
      <strong>启用底板样式</strong>
      ${renderToggleControl('', 'board', 'enabled', board.enabled)}
    </section>
    <section class="editorSection">
      <h3>快速预设</h3>
      <div class="boardPresetGrid">
        ${boardPresets
          .map(
            (preset) => `
              <button type="button" class="${board.pattern === preset.id ? 'active' : ''}" data-board-pattern="${preset.id}">
                <span class="miniPattern" style="${escapeAttribute(buildPreviewBoardStyle({
                  enabled: preset.id !== 'off',
                  pattern: preset.id,
                  size: defaultBoardSize(preset.id, board.size),
                  opacity: board.opacity,
                  color: board.color,
                }))}"></span>
                <strong>${preset.label}</strong>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
    <section class="settingCard">
      ${renderRangeControl('尺寸', 'board', 'size', board.size, 8, 40, 1, 'px')}
      ${renderRangeControl('不透明度', 'board', 'opacity', board.opacity, 0, 100, 1, '%')}
      ${renderColorControl('颜色', 'board', 'color', board.color)}
    </section>
  `;
}

function requireSelectedTheme(themes: ThemeDefinition[], themeId: string): ThemeDefinition {
  return selectPreviewTheme({
    themes,
    requestedThemeId: themeId,
  }).selectedTheme;
}

function activeThemeForAppearance(): ThemeDefinition {
  return applyThemeAppearance(
    requireSelectedTheme(dataset.themes, state.selectedThemeId),
    state.themeAppearance,
  );
}

function enterWechatCopyFlow(): void {
  const decision = decideWechatCopyEntry({
    acceptedThisSession: state.wechatClipboardConsentAcceptedThisSession,
  });

  if (decision === 'request-consent') {
    dismissToast();
    state.clipboardConsentDialogOpen = true;
    renderApp();
    app.querySelector<HTMLElement>('.clipboardConsentDialog')?.focus();
    return;
  }

  void copyCurrentArticleHtml();
}

async function copyCurrentArticleHtml(): Promise<void> {
  const preparedMarkdown = await prepareCurrentArticleForCopy();
  const selectedTheme = activeThemeForAppearance();
  const editedTheme = applyThemeStyleOverrides(
    selectedTheme,
    buildPreviewOverrides(state.editor),
    state.editor.decorationPreferences,
  );
  const html = renderThemeMarkdown({
    markdown: preparedMarkdown,
    theme: editedTheme,
    target: 'wechat-clipboard',
  }).html;
  const plainText = articlePlainTextFromHtml(html);
  const canWriteWechatRichText = canCopyWechatRichText({
    canCreateClipboardItem: typeof ClipboardItem === 'function',
    canWriteRichContent: typeof navigator.clipboard?.write === 'function',
  });

  const copyResult = await copyWechatArticle({
    canCopyAsynchronously: canWriteWechatRichText,
    copySynchronously: () => copyWechatArticleSynchronously({ html, plainText }),
    copyAsynchronously: async () => {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
    },
  });

  if (copyResult.status === 'failed') {
    const failureReason = copyResult.reason === 'rejected' ? String(copyResult.error) : 'clipboard APIs unavailable';
    console.warn(
      `[theme-preview] WeChat article copy failed reason="${failureReason}" secure_context=${window.isSecureContext}.`,
    );
    showToast('复制失败，请检查浏览器剪贴板权限');
    return;
  }

  showActionToast({
    message: '内容已复制，可以粘贴到公众号后台。',
    action: 'open-wechat-editor',
    actionLabel: '打开公众号后台',
  });
}

async function prepareCurrentArticleForCopy(): Promise<string> {
  const sourceMarkdown = state.article.markdown;
  try {
    const previewableMarkdown = prepareBundledArticleImages(state.article);
    const diagramResult = await embedArticleDiagramsAsImages({
      markdown: previewableMarkdown,
      renderer: browserArticleDiagramRenderer,
    });
    let preparedMarkdown = diagramResult.markdown;

    await recentArticleImageDirectoryReady;
    const directoryHandle = recentArticleImageDirectory;
    if (directoryHandle && collectLocalArticleImages(preparedMarkdown).length > 0) {
      const permission = await articleImageDirectoryPermission(directoryHandle, false);
      if (permission === 'granted') {
        const imageResult = await embedLocalArticleImages({
          markdown: preparedMarkdown,
          source: articleImageSourceFromDirectoryHandle(directoryHandle),
        });
        preparedMarkdown = imageResult.markdown;
      }
    }

    if (state.article.markdown !== sourceMarkdown) {
      console.warn(
        `[moyu-editor] copy preparation abandoned file="${state.article.fileName}" reason="markdown changed during preparation". Preparing the newest article instead.`,
      );
      return prepareCurrentArticleForCopy();
    }
    return preparedMarkdown;
  } catch (error) {
    console.warn(
      `[moyu-editor] copy preparation failed file="${state.article.fileName}" reason="${String(
        error,
      )}". Falling back to the latest visible preview.`,
    );
    return state.previewMarkdown;
  }
}

function openWechatEditorFromToast(): void {
  window.clearTimeout(toastTimer);
  state.toast = null;
  renderApp();

  const wechatEditorWindow = window.open(wechatEditorUrl, '_blank');
  if (wechatEditorWindow) {
    wechatEditorWindow.opener = null;
    return;
  }

  console.warn('[theme-preview] WeChat editor window blocked reason="browser denied the user-triggered new tab".');
  showToast('浏览器阻止了新标签页，请允许弹窗后重试');
}

function copyWechatArticleSynchronously(content: WechatArticleClipboardContent): boolean {
  const copySurface = document.createElement('section');
  copySurface.contentEditable = 'true';
  copySurface.tabIndex = -1;
  copySurface.setAttribute('aria-hidden', 'true');
  copySurface.style.position = 'fixed';
  copySurface.style.left = '-10000px';
  copySurface.style.top = '0';
  copySurface.style.width = '1px';
  copySurface.style.maxHeight = '1px';
  copySurface.style.overflow = 'hidden';
  copySurface.innerHTML = content.html;

  const selection = window.getSelection();
  const previousRanges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)) : [];
  const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const articleRange = document.createRange();
  articleRange.selectNodeContents(copySurface);

  copySurface.addEventListener('copy', (event) => {
    if (!event.clipboardData) {
      return;
    }

    event.clipboardData.setData('text/html', content.html);
    event.clipboardData.setData('text/plain', content.plainText);
    event.preventDefault();
  });
  document.body.appendChild(copySurface);

  try {
    copySurface.focus({ preventScroll: true });
    selection?.removeAllRanges();
    selection?.addRange(articleRange);
    const copied = document.execCommand('copy');
    if (!copied) {
      console.warn('[theme-preview] synchronous rich copy did not complete reason="document.execCommand returned false".');
    }
    return copied;
  } catch (error) {
    console.warn(`[theme-preview] synchronous rich copy failed reason="${String(error)}".`);
    return false;
  } finally {
    copySurface.remove();
    selection?.removeAllRanges();
    previousRanges.forEach((range) => selection?.addRange(range));
    previouslyFocusedElement?.focus({ preventScroll: true });
  }
}

async function shareSiteThroughSystem(): Promise<void> {
  state.mobileShareDialogOpen = false;
  renderApp();

  const result = await shareMoyuTypesetThroughSystem({
    inWechatBrowser: isWechatBrowser(window.navigator.userAgent),
    nativeShareSupported: typeof navigator.share === 'function',
    shareNatively: async () => {
      await navigator.share({
        title: '墨鱼排版',
        text: '免费开源的公众号 Markdown 排版工具，打开即用。',
        url: publicSiteUrl,
      });
    },
    copySiteLink: copyPublicSiteLink,
  });

  if (result.status === 'cancelled') {
    return;
  }

  if (result.status === 'guided') {
    presentToast({ message: '请点击微信右上角菜单，选择“转发给朋友”' }, 4_000);
    return;
  }

  if (result.status === 'failed') {
    console.warn(
      `[theme-preview] system share failed url="${publicSiteUrl}" reason="native share and clipboard fallback unavailable".`,
    );
    showToast('分享没有完成，请手动复制本站网址');
    return;
  }

  showToast(result.method === 'native' ? '分享已完成' : '系统分享不可用，链接已复制');
}

function shareSiteToTwitter(): void {
  state.mobileShareDialogOpen = false;
  renderApp();

  const shareWindow = window.open(
    buildTwitterShareUrl({
      text: '免费开源的公众号 Markdown 排版工具，打开即用。',
      url: publicSiteUrl,
    }),
    '_blank',
  );
  if (shareWindow) {
    shareWindow.opener = null;
    return;
  }

  console.warn('[theme-preview] Twitter share window blocked reason="browser denied the user-triggered new tab".');
  showToast('浏览器阻止了分享页面，请允许弹窗后重试');
}

async function copyMobileShareLink(): Promise<void> {
  state.mobileShareDialogOpen = false;
  renderApp();

  if (await copyPublicSiteLink()) {
    showToast('分享链接已复制');
    return;
  }

  console.warn(`[theme-preview] mobile share link copy failed url="${publicSiteUrl}".`);
  showToast('复制失败，请手动复制本站网址');
}

async function copyPublicSiteLink(): Promise<boolean> {
  if (copyPlainTextSynchronously(publicSiteUrl)) {
    return true;
  }

  if (typeof navigator.clipboard?.writeText !== 'function') {
    return false;
  }

  try {
    await navigator.clipboard.writeText(publicSiteUrl);
    return true;
  } catch (error) {
    console.warn(`[theme-preview] site link clipboard fallback failed url="${publicSiteUrl}" reason="${String(error)}".`);
    return false;
  }
}

function copyPlainTextSynchronously(text: string): boolean {
  const copyInput = document.createElement('textarea');
  copyInput.value = text;
  copyInput.setAttribute('readonly', 'true');
  copyInput.style.position = 'fixed';
  copyInput.style.left = '-10000px';
  copyInput.style.top = '0';
  document.body.appendChild(copyInput);
  copyInput.select();

  try {
    return document.execCommand('copy');
  } catch (error) {
    console.warn(`[theme-preview] synchronous site link copy failed reason="${String(error)}".`);
    return false;
  } finally {
    copyInput.remove();
  }
}

function readWechatClipboardConsent(): boolean {
  try {
    const storedConsent = window.sessionStorage.getItem(wechatClipboardConsentKey);
    if (storedConsent === null) {
      return false;
    }
    if (storedConsent === 'accepted') {
      return true;
    }

    console.warn(
      `[theme-preview] clipboard consent ignored stored_value="${storedConsent}" reason="unknown session value". Requesting consent again.`,
    );
    return false;
  } catch (error) {
    console.warn(`[theme-preview] clipboard consent read failed reason="${String(error)}". Requesting consent again.`);
    return false;
  }
}

function acceptWechatClipboardConsent(): void {
  state.wechatClipboardConsentAcceptedThisSession = true;
  try {
    window.sessionStorage.setItem(wechatClipboardConsentKey, 'accepted');
  } catch (error) {
    console.warn(
      `[theme-preview] clipboard consent persistence failed reason="${String(error)}". Keeping consent for the current page only.`,
    );
  }
}

function showToast(message: string): void {
  presentToast({ message }, 1_800);
}

function showActionToast(notice: ToastNotice): void {
  presentToast(notice, 10_000);
}

function presentToast(notice: ToastNotice, visibleMs: number): void {
  state.toast = notice;
  window.clearTimeout(toastTimer);
  renderApp();
  toastTimer = window.setTimeout(() => {
    state.toast = null;
    renderApp();
  }, visibleMs);
}

function dismissToast(): void {
  window.clearTimeout(toastTimer);
  state.toast = null;
}

function readStoredArticleDraft(): string | null {
  try {
    return window.localStorage.getItem(articleDraftStorageKey);
  } catch (error) {
    console.warn(
      `[moyu-editor] stored article draft unavailable reason="${String(error)}". Falling back to bundled article.`,
    );
    return null;
  }
}

function clearStoredArticleDraft(): void {
  try {
    window.localStorage.removeItem(articleDraftStorageKey);
  } catch (error) {
    console.warn(
      `[moyu-editor] stored article draft cleanup failed reason="${String(
        error,
      )}". The restored bundled article remains active in memory.`,
    );
  }
}

function restoreBundledArticle(): void {
  window.clearTimeout(articleDraftSaveTimer);
  window.clearTimeout(editedArticlePreparationTimer);
  articlePreparation.begin();
  clearStoredArticleDraft();
  openedArticleIdentity = null;
  state.article = { ...bundledArticle };
  state.previewMarkdown = generatedArticleMarkdown;
  state.articleImages = null;
  state.articleDraftSavePhase = 'saved';
  resetMarkdownEditorPosition();
  resetPreviewReadingPosition();
  renderApp();
  void prepareInitialArticlePreview();
  showToast('已恢复示例内容');
}

function resetMarkdownEditorPosition(): void {
  state.markdownSelection = { anchor: 0, head: 0 };
  state.markdownScrollTop = 0;
}

function articleCharacterCount(markdown: string): number {
  return markdown.replace(/\s/g, '').length;
}

function articleDraftSaveLabel(phase: ArticleDraftSavePhase): string {
  const labels: Record<ArticleDraftSavePhase, string> = {
    saved: '已自动保存',
    saving: '保存中…',
    failed: '保存失败',
  };
  return labels[phase];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initialMarkdownPaneWidth(): number {
  const approximateWorkbenchWidth = Math.max(720, window.innerWidth - desktopSettingsPanelWidth);
  return constrainMarkdownPaneWidth({
    workbenchWidth: approximateWorkbenchWidth,
    requestedWidth: Math.round(approximateWorkbenchWidth * 0.38),
    dividerWidth: workbenchDividerWidth,
    minimumMarkdownWidth: minimumMarkdownPaneWidth,
    minimumPreviewWidth: minimumPreviewPaneWidth,
  });
}

function prepareBundledArticleImages(article: ArticleDocument): string {
  return article.source === 'demo'
    ? embedKnownArticleImages(article.markdown, generatedArticleImages)
    : article.markdown;
}

function readStoredThemeId(): string | null {
  try {
    return window.localStorage.getItem('theme-preview:selected-theme');
  } catch (error) {
    console.warn(`[theme-preview] localStorage read failed reason="${String(error)}". Falling back to URL/first theme.`);
    return null;
  }
}

function persistSelectedTheme(themeId: string): void {
  try {
    window.localStorage.setItem('theme-preview:selected-theme', themeId);
  } catch (error) {
    console.warn(`[theme-preview] localStorage write failed theme="${themeId}" reason="${String(error)}".`);
  }
}

function readStoredThemeAppearance(): string | null {
  try {
    return window.localStorage.getItem(themeAppearanceStorageKey);
  } catch (error) {
    console.warn(
      `[theme-preview] stored theme appearance unavailable reason="${String(error)}". Falling back to URL/light appearance.`,
    );
    return null;
  }
}

function persistThemeAppearance(appearance: ThemeAppearance): void {
  try {
    window.localStorage.setItem(themeAppearanceStorageKey, appearance);
  } catch (error) {
    console.warn(
      `[theme-preview] theme appearance write failed appearance="${appearance}" reason="${String(error)}".`,
    );
  }
}

function reflectThemeSelectionInUrl(themeId: string, appearance: ThemeAppearance): void {
  const url = new URL(window.location.href);
  url.searchParams.set('theme', themeId);
  url.searchParams.set('appearance', appearance);
  window.history.replaceState(null, '', url);
}

function buildPreviewOverrides(editorState: StyleEditorState): ThemeStyleOverrides {
  const boardPatternStyle = buildPreviewBoardStyleMap(editorState.board);
  const nextOverrides = structuredClone(editorState.overrides);

  nextOverrides.background.container = {
    ...nextOverrides.background.container,
    ...boardPatternStyle,
  };

  return nextOverrides;
}

function readStoredEditorState(): StyleEditorState | null {
  try {
    const storedState = window.localStorage.getItem('theme-preview:style-editor');
    if (!storedState) {
      return null;
    }

    return focusStyleEditorOnBodyText(JSON.parse(storedState) as StyleEditorState);
  } catch (error) {
    console.warn(`[theme-preview] style editor state ignored reason="${String(error)}". Falling back to defaults.`);
    return null;
  }
}

function persistEditorState(editorState: StyleEditorState): void {
  try {
    window.localStorage.setItem('theme-preview:style-editor', JSON.stringify(editorState));
  } catch (error) {
    console.warn(`[theme-preview] style editor state write failed reason="${String(error)}".`);
  }
}

function clearStoredEditorState(): void {
  try {
    window.localStorage.removeItem('theme-preview:style-editor');
  } catch (error) {
    console.warn(`[theme-preview] style editor state clear failed reason="${String(error)}".`);
  }
}

function resetEditorState(): void {
  const selectedTheme = requireSelectedTheme(dataset.themes, state.selectedThemeId);
  state.editor = resetStyleEditorToOriginal(state.editor, firstDecorationTarget(selectedTheme));
  clearStoredEditorState();
}

function updateStyleControl(control: HTMLInputElement | HTMLSelectElement): void {
  const scope = control.dataset.styleScope;
  const styleKey = control.dataset.styleKey;
  if (!scope || !styleKey) {
    return;
  }

  if (scope === 'reset') {
    resetEditorState();
    return;
  }

  const value = controlValue(control);

  if (scope === 'text') {
    assignTextStyle(state.editor.textTarget, styleKey, value);
    return;
  }

  if (scope === 'strong') {
    state.editor.overrides.strong[styleKey] = value;
    return;
  }

  if (scope === 'image.image') {
    state.editor.overrides.image.image[styleKey] = value;
    return;
  }

  if (scope === 'image.figure') {
    state.editor.overrides.image.figure[styleKey] = value;
    return;
  }

  if (scope === 'image.figcaption') {
    state.editor.overrides.image.figcaption[styleKey] = value;
    return;
  }

  if (scope === 'background.container') {
    state.editor.overrides.background.container[styleKey] = value;
    return;
  }

  if (scope === 'board') {
    updateBoardSetting(styleKey, value);
    return;
  }

  if (scope === 'decoration-settings') {
    updateDecorationPreference(styleKey, value);
    return;
  }

  if (scope.startsWith('decoration.')) {
    const componentName = scope.slice('decoration.'.length);
    state.editor.overrides.decorations[componentName] = {
      ...(state.editor.overrides.decorations[componentName] ?? {}),
      [styleKey]: value,
    };
  }
}

function controlValue(control: HTMLInputElement | HTMLSelectElement): string {
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    if (control.dataset.styleKey === 'display') {
      return control.checked ? 'block' : 'none';
    }

    return control.checked ? 'true' : 'false';
  }

  const unit = control.dataset.unit ?? '';
  return `${control.value}${unit}`;
}

function updateBoardSetting(styleKey: string, value: string): void {
  if (styleKey === 'enabled') {
    state.editor.board.enabled = value === 'true';
    return;
  }

  if (styleKey === 'color') {
    state.editor.board.color = value;
    return;
  }

  if (styleKey === 'size' || styleKey === 'opacity') {
    state.editor.board[styleKey] = Number.parseFloat(value);
  }
}

function updateDecorationPreference(styleKey: string, value: string): void {
  if (styleKey === 'sectionDividerEnabled') {
    state.editor.decorationPreferences.sectionDividerEnabled = value === 'true';
  }
}

function assignTextStyle(target: TextStyleTarget, styleKey: string, value: string): void {
  state.editor.overrides.text[target] = {
    ...(state.editor.overrides.text[target] ?? {}),
    [styleKey]: value,
  };
}

function firstDecorationTarget(theme: ThemeDefinition): string {
  return decorationTargets(theme)[0]?.componentName ?? '';
}

function normalizeDecorationTarget(theme: ThemeDefinition): void {
  const targets = decorationTargets(theme);
  if (targets.length === 0) {
    state.editor.decorationTarget = '';
    return;
  }

  if (!targets.some((target) => target.componentName === state.editor.decorationTarget)) {
    console.warn(
      `[theme-preview] decoration target reset theme="${theme.value || theme.id}" stored="${state.editor.decorationTarget}" next="${targets[0].componentName}".`,
    );
    state.editor.decorationTarget = targets[0].componentName;
    persistEditorState(state.editor);
  }
}

function decorationTargets(theme: ThemeDefinition): Array<{
  label: string;
  ruleKey: string;
  componentName: string;
  variant?: string;
}> {
  return Object.entries(theme.config?.rules ?? {})
    .filter(([, rule]) => Boolean(rule.decoration))
    .map(([ruleKey, rule]) => ({
      label: decorationRuleLabel(ruleKey),
      ruleKey,
      componentName: rule.decoration ?? '',
      variant: rule.variant,
    }));
}

function renderRangeControl(
  label: string,
  scope: string,
  styleKey: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string,
): string {
  return `
    <label class="controlRow">
      <span>${label}</span>
      <input class="rangeInput" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-style-scope="${scope}" data-style-key="${styleKey}" data-unit="${unit}" />
      <input class="valueInput" type="text" value="${escapeAttribute(`${value}${unit}`)}" data-style-scope="${scope}" data-style-key="${styleKey}" />
    </label>
  `;
}

function renderColorControl(label: string, scope: string, styleKey: string, value: string): string {
  return `
    <label class="controlRow">
      <span>${label}</span>
      <input class="colorInput" type="color" value="${escapeAttribute(value)}" data-style-scope="${scope}" data-style-key="${styleKey}" />
      <input class="valueInput" type="text" value="${escapeAttribute(value)}" data-style-scope="${scope}" data-style-key="${styleKey}" />
    </label>
  `;
}

function renderTextControl(label: string, scope: string, styleKey: string, value: string): string {
  return `
    <label class="controlRow">
      <span>${label}</span>
      <input class="wideInput" type="text" value="${escapeAttribute(value)}" data-style-scope="${scope}" data-style-key="${styleKey}" />
    </label>
  `;
}

function renderSelectControl(label: string, scope: string, styleKey: string, value: string, options: string[][]): string {
  return `
    <label class="controlRow">
      <span>${label}</span>
      <select class="wideInput" data-style-scope="${scope}" data-style-key="${styleKey}">
        ${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${value === optionValue ? 'selected' : ''}>${optionLabel}</option>`).join('')}
      </select>
    </label>
  `;
}

function renderToggleControl(label: string, scope: string, styleKey: string, enabled: boolean): string {
  return `
    <label class="toggleControl">
      ${label ? `<span><strong>${label}</strong></span>` : ''}
      <input type="checkbox" ${enabled ? 'checked' : ''} data-style-scope="${scope}" data-style-key="${styleKey}" />
      <i></i>
    </label>
  `;
}

function renderAlignControl(value: string): string {
  const options = [
    ['left', 'ti-align-left'],
    ['center', 'ti-align-center'],
    ['right', 'ti-align-right'],
    ['justify', 'ti-align-justified'],
  ];

  return `
    <div class="controlRow">
      <span>对齐</span>
      <div class="buttonGroup">
        ${options
          .map(
            ([align, icon]) =>
              `<button type="button" class="${value === align ? 'active' : ''}" data-align="${align}" title="${align}"><i class="ti ${icon}"></i></button>`,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderDecorationPreview(template: string, styleMap: Record<string, unknown>): string {
  if (!template) {
    return '';
  }

  return template
    .replace(/\{\{content\}\}/g, '示例文本内容')
    .replace(/\{\{number\}\}/g, '01')
    .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => {
      const value = styleMap[key];
      return value == null ? '' : String(value);
    });
}

function stringStyle(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numericStyle(value: unknown, fallback: number): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  return fallback;
}

function normalizeColorValue(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
}

function shadowLabel(level: string): string {
  const labels: Record<string, string> = {
    none: '无',
    light: '轻',
    medium: '中',
    heavy: '重',
  };
  return labels[level] ?? level;
}

function paddingPresetLabel(preset: string): string {
  const labels: Record<string, string> = {
    none: '无',
    tight: '紧凑',
    medium: '适中',
    loose: '宽松',
    wide: '超宽',
  };
  return labels[preset] ?? preset;
}

function paddingPresetValue(preset: string): string {
  const values: Record<string, string> = {
    none: '0',
    tight: '0.5rem 0.75rem',
    medium: '1rem',
    loose: '1.5rem',
    wide: '2rem',
  };
  return values[preset] ?? '1rem';
}

function defaultBoardSize(pattern: BoardPattern, currentSize: number): number {
  const values: Partial<Record<BoardPattern, number>> = {
    'fine-grid': 15,
    'standard-grid': 24,
    'coarse-grid': 36,
    dot: 24,
    cross: 28,
  };
  return values[pattern] ?? currentSize;
}

function decorationRuleLabel(ruleKey: string): string {
  const labels: Record<string, string> = {
    h1: '一级标题',
    h2: '二级标题',
    h3: '三级标题',
    blockquote: '引用块',
    h2_content: '二级标题内容',
    section_divider: '章节分隔符',
  };
  return labels[ruleKey] ?? ruleKey;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

renderApp();
void prepareInitialArticlePreview();
