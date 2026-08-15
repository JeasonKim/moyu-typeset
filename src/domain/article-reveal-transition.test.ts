import { describe, expect, it, vi } from 'vitest';
import { coordinateArticleRevealTransition } from './article-reveal-transition';

function createTestRuntime() {
  let currentTime = 0;
  let nextTimerId = 0;
  const timers = new Map<number, { dueAt: number; callback: () => void }>();

  return {
    clock: {
      now(): number {
        return currentTime;
      },
    },
    scheduler: {
      schedule(callback: () => void, delayMs: number): number {
        nextTimerId += 1;
        timers.set(nextTimerId, { dueAt: currentTime + delayMs, callback });
        return nextTimerId;
      },
      cancel(timerId: number): void {
        timers.delete(timerId);
      },
    },
    advanceBy(durationMs: number): void {
      currentTime += durationMs;
      const dueTimers = [...timers.entries()].filter(([, timer]) => timer.dueAt <= currentTime);
      dueTimers.forEach(([timerId, timer]) => {
        timers.delete(timerId);
        timer.callback();
      });
    },
  };
}

describe('coordinateArticleRevealTransition', () => {
  it('keeps a short article load visible before revealing it through the spotlight', () => {
    const showLoading = vi.fn();
    const openCurtain = vi.fn();
    const concludeReveal = vi.fn();
    const activateArticle = vi.fn();
    const { clock, scheduler, advanceBy } = createTestRuntime();
    const transition = coordinateArticleRevealTransition({
      minimumLoadingMs: 600,
      curtainOpeningMs: 1_400,
      clock,
      scheduler,
      presentation: { showLoading, openCurtain, concludeReveal },
    });

    const operation = transition.begin();
    advanceBy(200);
    operation.revealArticle(activateArticle);

    expect(showLoading).toHaveBeenCalledTimes(1);
    expect(activateArticle).not.toHaveBeenCalled();
    advanceBy(399);
    expect(openCurtain).not.toHaveBeenCalled();
    advanceBy(1);
    expect(activateArticle).toHaveBeenCalledTimes(1);
    expect(openCurtain).toHaveBeenCalledTimes(1);
    advanceBy(1_400);
    expect(concludeReveal).toHaveBeenCalledTimes(1);
  });

  it('prevents an older preparation from revealing after a newer import starts', () => {
    const showLoading = vi.fn();
    const openCurtain = vi.fn();
    const concludeReveal = vi.fn();
    const { clock, scheduler } = createTestRuntime();
    const transition = coordinateArticleRevealTransition({
      minimumLoadingMs: 600,
      curtainOpeningMs: 1_400,
      clock,
      scheduler,
      presentation: { showLoading, openCurtain, concludeReveal },
    });
    const olderOperation = transition.begin();
    const latestOperation = transition.begin();
    const activateOlderArticle = vi.fn();

    olderOperation.revealArticle(activateOlderArticle);

    expect(olderOperation.isCurrent()).toBe(false);
    expect(latestOperation.isCurrent()).toBe(true);
    expect(activateOlderArticle).not.toHaveBeenCalled();
  });

  it('removes the loading state when the current import fails', () => {
    const showLoading = vi.fn();
    const openCurtain = vi.fn();
    const concludeReveal = vi.fn();
    const { clock, scheduler } = createTestRuntime();
    const transition = coordinateArticleRevealTransition({
      minimumLoadingMs: 600,
      curtainOpeningMs: 1_400,
      clock,
      scheduler,
      presentation: { showLoading, openCurtain, concludeReveal },
    });

    transition.begin().cancel();

    expect(concludeReveal).toHaveBeenCalledTimes(1);
    expect(openCurtain).not.toHaveBeenCalled();
  });
});
