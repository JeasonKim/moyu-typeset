export interface ArticlePreparationOperation {
  isCurrent(): boolean;
}

export interface ArticlePreparationCoordinator {
  begin(): ArticlePreparationOperation;
  invalidate(): void;
}

export function coordinateArticlePreparation(): ArticlePreparationCoordinator {
  let currentPreparationId = 0;

  return {
    begin(): ArticlePreparationOperation {
      currentPreparationId += 1;
      const preparationId = currentPreparationId;
      return {
        isCurrent(): boolean {
          return preparationId === currentPreparationId;
        },
      };
    },
    invalidate(): void {
      currentPreparationId += 1;
    },
  };
}
