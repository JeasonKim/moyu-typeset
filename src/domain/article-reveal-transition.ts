export interface ArticleRevealClock {
  now(): number;
}

export interface ArticleRevealScheduler {
  schedule(callback: () => void, delayMs: number): number;
  cancel(timerId: number): void;
}

export interface ArticleRevealPresentation {
  showLoading(): void;
  openCurtain(): void;
  concludeReveal(): void;
}

export interface ArticleRevealTransitionOptions {
  minimumLoadingMs: number;
  curtainOpeningMs: number;
  clock: ArticleRevealClock;
  scheduler: ArticleRevealScheduler;
  presentation: ArticleRevealPresentation;
}

export interface ArticleRevealOperation {
  isCurrent(): boolean;
  revealArticle(activateArticle: () => void): void;
  cancel(): void;
}

export interface ArticleRevealTransition {
  begin(): ArticleRevealOperation;
}

export function coordinateArticleRevealTransition(
  options: ArticleRevealTransitionOptions,
): ArticleRevealTransition {
  let transitionSequence = 0;
  let pendingLoadingTimer: number | undefined;
  let pendingCurtainTimer: number | undefined;

  function cancelScheduledSteps(): void {
    if (pendingLoadingTimer !== undefined) {
      options.scheduler.cancel(pendingLoadingTimer);
      pendingLoadingTimer = undefined;
    }
    if (pendingCurtainTimer !== undefined) {
      options.scheduler.cancel(pendingCurtainTimer);
      pendingCurtainTimer = undefined;
    }
  }

  return {
    begin(): ArticleRevealOperation {
      cancelScheduledSteps();
      transitionSequence += 1;
      const currentTransition = transitionSequence;
      const loadingStartedAt = options.clock.now();
      let revealRequested = false;
      options.presentation.showLoading();

      return {
        isCurrent(): boolean {
          return currentTransition === transitionSequence;
        },
        revealArticle(activateArticle: () => void): void {
          if (revealRequested || currentTransition !== transitionSequence) {
            return;
          }

          revealRequested = true;
          const loadingDuration = options.clock.now() - loadingStartedAt;
          const remainingLoadingDuration = Math.max(0, options.minimumLoadingMs - loadingDuration);
          const reveal = () => {
            pendingLoadingTimer = undefined;
            if (currentTransition !== transitionSequence) {
              return;
            }

            activateArticle();
            options.presentation.openCurtain();
            pendingCurtainTimer = options.scheduler.schedule(() => {
              pendingCurtainTimer = undefined;
              if (currentTransition === transitionSequence) {
                options.presentation.concludeReveal();
              }
            }, options.curtainOpeningMs);
          };

          if (remainingLoadingDuration === 0) {
            reveal();
            return;
          }

          pendingLoadingTimer = options.scheduler.schedule(reveal, remainingLoadingDuration);
        },
        cancel(): void {
          if (currentTransition !== transitionSequence) {
            return;
          }

          transitionSequence += 1;
          cancelScheduledSteps();
          options.presentation.concludeReveal();
        },
      };
    },
  };
}
