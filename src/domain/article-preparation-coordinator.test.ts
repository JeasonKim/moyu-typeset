import { describe, expect, it } from 'vitest';
import { coordinateArticlePreparation } from './article-preparation-coordinator';

describe('coordinateArticlePreparation', () => {
  it('allows only the latest article preparation to replace the preview', () => {
    const coordinator = coordinateArticlePreparation();
    const olderPreparation = coordinator.begin();
    const latestPreparation = coordinator.begin();

    expect(olderPreparation.isCurrent()).toBe(false);
    expect(latestPreparation.isCurrent()).toBe(true);
  });

  it('can invalidate the current preparation without presenting global feedback', () => {
    const coordinator = coordinateArticlePreparation();
    const preparation = coordinator.begin();

    coordinator.invalidate();

    expect(preparation.isCurrent()).toBe(false);
  });
});
