import { ContentRepository } from "../repositories/content.repository";
import { calculateNextReviewDate } from "../utils/reviewScheduler";

export class ReviewService {
  constructor(private readonly contentRepository: ContentRepository) {}

  async recordReview(itemId: string, wasCorrect: boolean) {
    const payload = await this.contentRepository.getDashboardContent();
    const item = payload.vocabulary.find((entry) => entry.id === itemId);

    if (!item) {
      return null;
    }

    const nextHits = wasCorrect ? item.hits + 1 : item.hits;
    const nextMisses = wasCorrect ? item.misses : item.misses + 1;
    const nextConfidence = Math.max(
      10,
      Math.min(100, item.confidence + (wasCorrect ? 8 : -12))
    );
    const nextReviewAt = calculateNextReviewDate(nextHits, wasCorrect).toISOString();

    return this.contentRepository.updateVocabularyReview(itemId, {
      hits: nextHits,
      misses: nextMisses,
      confidence: nextConfidence,
      nextReviewAt,
    });
  }
}
