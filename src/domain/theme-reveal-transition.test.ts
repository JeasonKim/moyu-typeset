import { describe, expect, it, vi } from 'vitest';
import {
  coordinateThemeRevealTransition,
  type ThemeRevealScheduler,
} from './theme-reveal-transition';

function controlledScheduler(): ThemeRevealScheduler & { advanceBy: (elapsedMs: number) => void } {
  let elapsedMs = 0;
  let nextTimerId = 1;
  const timers = new Map<number, { runAt: number; callback: () => void }>();

  return {
    schedule(callback, delayMs) {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, { runAt: elapsedMs + delayMs, callback });
      return timerId;
    },
    cancel(timerId) {
      timers.delete(timerId);
    },
    advanceBy(durationMs) {
      const targetTime = elapsedMs + durationMs;
      while (true) {
        const nextTimer = [...timers.entries()]
          .filter(([, timer]) => timer.runAt <= targetTime)
          .sort((left, right) => left[1].runAt - right[1].runAt)[0];
        if (!nextTimer) {
          break;
        }

        const [timerId, timer] = nextTimer;
        timers.delete(timerId);
        elapsedMs = timer.runAt;
        timer.callback();
      }
      elapsedMs = targetTime;
    },
  };
}

describe('主题揭幕时序', () => {
  it('先播放品牌加载，再切换主题并打开幕布', () => {
    const scheduler = controlledScheduler();
    const showBrandLoading = vi.fn();
    const openThemeCurtain = vi.fn();
    const concludeThemeReveal = vi.fn();
    const activateTheme = vi.fn();
    const transition = coordinateThemeRevealTransition({
      brandLoadingMs: 800,
      curtainOpeningMs: 1_400,
      scheduler,
      presentation: { showBrandLoading, openThemeCurtain, concludeThemeReveal },
    });

    transition.begin({ activateTheme });

    expect(showBrandLoading).toHaveBeenCalledOnce();
    expect(activateTheme).not.toHaveBeenCalled();

    scheduler.advanceBy(799);
    expect(openThemeCurtain).not.toHaveBeenCalled();

    scheduler.advanceBy(1);
    expect(activateTheme).toHaveBeenCalledOnce();
    expect(openThemeCurtain).toHaveBeenCalledOnce();
    expect(concludeThemeReveal).not.toHaveBeenCalled();

    scheduler.advanceBy(1_400);
    expect(concludeThemeReveal).toHaveBeenCalledOnce();
  });

  it('新的主题选择会取代尚未完成的揭幕', () => {
    const scheduler = controlledScheduler();
    const concludeThemeReveal = vi.fn();
    const firstTheme = vi.fn();
    const latestTheme = vi.fn();
    const transition = coordinateThemeRevealTransition({
      brandLoadingMs: 800,
      curtainOpeningMs: 1_400,
      scheduler,
      presentation: {
        showBrandLoading: vi.fn(),
        openThemeCurtain: vi.fn(),
        concludeThemeReveal,
      },
    });

    transition.begin({ activateTheme: firstTheme });
    scheduler.advanceBy(400);
    transition.begin({ activateTheme: latestTheme });
    scheduler.advanceBy(800);

    expect(firstTheme).not.toHaveBeenCalled();
    expect(latestTheme).toHaveBeenCalledOnce();

    scheduler.advanceBy(1_400);
    expect(concludeThemeReveal).toHaveBeenCalledOnce();
  });
});
