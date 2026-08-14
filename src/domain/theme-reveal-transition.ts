export interface ThemeRevealRequest {
  activateTheme: () => void;
}

export interface ThemeRevealScheduler {
  schedule: (callback: () => void, delayMs: number) => number;
  cancel: (timerId: number) => void;
}

export interface ThemeRevealPresentation {
  showBrandLoading: () => void;
  openThemeCurtain: () => void;
  concludeThemeReveal: () => void;
}

export interface ThemeRevealTransitionOptions {
  brandLoadingMs: number;
  curtainOpeningMs: number;
  scheduler: ThemeRevealScheduler;
  presentation: ThemeRevealPresentation;
}

export interface ThemeRevealTransition {
  begin: (request: ThemeRevealRequest) => void;
}

export function coordinateThemeRevealTransition(options: ThemeRevealTransitionOptions): ThemeRevealTransition {
  let transitionSequence = 0;
  let brandLoadingTimer: number | undefined;
  let curtainOpeningTimer: number | undefined;

  function cancelScheduledSteps(): void {
    if (brandLoadingTimer !== undefined) {
      options.scheduler.cancel(brandLoadingTimer);
      brandLoadingTimer = undefined;
    }
    if (curtainOpeningTimer !== undefined) {
      options.scheduler.cancel(curtainOpeningTimer);
      curtainOpeningTimer = undefined;
    }
  }

  return {
    begin(request) {
      cancelScheduledSteps();
      transitionSequence += 1;
      const currentTransition = transitionSequence;
      options.presentation.showBrandLoading();

      brandLoadingTimer = options.scheduler.schedule(() => {
        brandLoadingTimer = undefined;
        if (currentTransition !== transitionSequence) {
          return;
        }

        request.activateTheme();
        options.presentation.openThemeCurtain();

        curtainOpeningTimer = options.scheduler.schedule(() => {
          curtainOpeningTimer = undefined;
          if (currentTransition === transitionSequence) {
            options.presentation.concludeThemeReveal();
          }
        }, options.curtainOpeningMs);
      }, options.brandLoadingMs);
    },
  };
}
