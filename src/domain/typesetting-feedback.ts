export interface TypesettingFeedbackClock {
  now(): number;
}

export interface TypesettingFeedbackScheduler {
  schedule(callback: () => void, delayMs: number): number;
  cancel(timerId: number): void;
}

export interface TypesettingFeedbackPresentation {
  reveal(): void;
  conceal(): void;
}

export interface TypesettingFeedbackOperation {
  isCurrent(): boolean;
  finish(): void;
}

export interface TypesettingFeedbackCoordinator {
  begin(): TypesettingFeedbackOperation;
  invalidate(): void;
}

export interface TypesettingFeedbackOptions {
  minimumVisibleMs: number;
  clock: TypesettingFeedbackClock;
  scheduler: TypesettingFeedbackScheduler;
  presentation: TypesettingFeedbackPresentation;
}

export function coordinateTypesettingFeedback(options: TypesettingFeedbackOptions): TypesettingFeedbackCoordinator {
  let currentOperationId = 0;
  let pendingConcealTimerId: number | undefined;

  function cancelPendingConceal(): void {
    if (pendingConcealTimerId === undefined) {
      return;
    }

    options.scheduler.cancel(pendingConcealTimerId);
    pendingConcealTimerId = undefined;
  }

  function invalidateCurrentOperation(): void {
    currentOperationId += 1;
    cancelPendingConceal();
    options.presentation.conceal();
  }

  return {
    begin(): TypesettingFeedbackOperation {
      invalidateCurrentOperation();
      const operationId = currentOperationId;
      const revealedAt = options.clock.now();
      let finished = false;
      options.presentation.reveal();

      return {
        isCurrent(): boolean {
          return operationId === currentOperationId;
        },
        finish(): void {
          if (finished) {
            return;
          }

          finished = true;
          if (operationId !== currentOperationId) {
            return;
          }

          const visibleDuration = options.clock.now() - revealedAt;
          const remainingDuration = Math.max(0, options.minimumVisibleMs - visibleDuration);
          if (remainingDuration === 0) {
            options.presentation.conceal();
            return;
          }

          pendingConcealTimerId = options.scheduler.schedule(() => {
            if (operationId !== currentOperationId) {
              return;
            }

            pendingConcealTimerId = undefined;
            options.presentation.conceal();
          }, remainingDuration);
        },
      };
    },
    invalidate(): void {
      invalidateCurrentOperation();
    },
  };
}
