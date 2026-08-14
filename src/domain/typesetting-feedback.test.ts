import { describe, expect, it, vi } from 'vitest';
import { coordinateTypesettingFeedback } from './typesetting-feedback';

function createTestRuntime() {
  let currentTime = 0;
  let nextTimerId = 0;
  const callbacks = new Map<number, { dueAt: number; callback: () => void }>();

  return {
    clock: {
      now(): number {
        return currentTime;
      },
    },
    scheduler: {
      schedule(callback: () => void, delayMs: number): number {
        nextTimerId += 1;
        callbacks.set(nextTimerId, { dueAt: currentTime + delayMs, callback });
        return nextTimerId;
      },
      cancel(timerId: number): void {
        callbacks.delete(timerId);
      },
    },
    advanceBy(durationMs: number): void {
      currentTime += durationMs;
      const dueCallbacks = [...callbacks.entries()].filter(([, scheduled]) => scheduled.dueAt <= currentTime);
      dueCallbacks.forEach(([timerId, scheduled]) => {
        callbacks.delete(timerId);
        scheduled.callback();
      });
    },
  };
}

describe('coordinateTypesettingFeedback', () => {
  it('reveals immediately and keeps fast typesetting visible for the minimum duration', () => {
    const reveal = vi.fn();
    const conceal = vi.fn();
    const { clock, scheduler, advanceBy } = createTestRuntime();
    const coordinator = coordinateTypesettingFeedback({
      minimumVisibleMs: 800,
      clock,
      scheduler,
      presentation: { reveal, conceal },
    });

    const operation = coordinator.begin();
    conceal.mockClear();
    operation.finish();

    expect(reveal).toHaveBeenCalledTimes(1);
    advanceBy(799);
    expect(conceal).not.toHaveBeenCalled();
    advanceBy(1);
    expect(conceal).toHaveBeenCalledTimes(1);
  });

  it('conceals immediately when slow typesetting already exceeded the minimum duration', () => {
    const reveal = vi.fn();
    const conceal = vi.fn();
    const { clock, scheduler, advanceBy } = createTestRuntime();
    const coordinator = coordinateTypesettingFeedback({
      minimumVisibleMs: 800,
      clock,
      scheduler,
      presentation: { reveal, conceal },
    });

    const operation = coordinator.begin();
    conceal.mockClear();
    advanceBy(900);
    operation.finish();

    expect(reveal).toHaveBeenCalledTimes(1);
    expect(conceal).toHaveBeenCalledTimes(1);
  });

  it('prevents an older operation from replacing or hiding the latest preview', () => {
    const reveal = vi.fn();
    const conceal = vi.fn();
    const { clock, scheduler, advanceBy } = createTestRuntime();
    const coordinator = coordinateTypesettingFeedback({
      minimumVisibleMs: 800,
      clock,
      scheduler,
      presentation: { reveal, conceal },
    });

    const olderOperation = coordinator.begin();
    const latestOperation = coordinator.begin();
    reveal.mockClear();
    conceal.mockClear();
    olderOperation.finish();

    expect(olderOperation.isCurrent()).toBe(false);
    expect(latestOperation.isCurrent()).toBe(true);
    expect(conceal).not.toHaveBeenCalled();

    latestOperation.finish();
    advanceBy(800);
    expect(conceal).toHaveBeenCalledTimes(1);
  });

  it('invalidates visible feedback when another article source takes over', () => {
    const reveal = vi.fn();
    const conceal = vi.fn();
    const { clock, scheduler, advanceBy } = createTestRuntime();
    const coordinator = coordinateTypesettingFeedback({
      minimumVisibleMs: 800,
      clock,
      scheduler,
      presentation: { reveal, conceal },
    });

    const operation = coordinator.begin();
    conceal.mockClear();
    coordinator.invalidate();
    advanceBy(800);

    expect(operation.isCurrent()).toBe(false);
    expect(conceal).toHaveBeenCalledTimes(1);
  });
});
