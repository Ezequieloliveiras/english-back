import { ContentRepository } from "../repositories/content.repository";
import { DailyPlanService } from "./dailyPlan.service";
import { calculateNextReviewDate } from "../utils/reviewScheduler";

export class ReviewService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly dailyPlanService: DailyPlanService
  ) {}

  async recordReview(userId: string, itemId: string, wasCorrect: boolean) {
    const payload = await this.contentRepository.getLearningContent(userId);
    let item = payload.vocabulary.find((entry) => entry.id === itemId);

    if (!item) {
      const { user, dailyPlan } = await this.dailyPlanService.createOrGetTodayPlan(userId);
      const personalized = this.contentRepository.personalizeForPlan(payload, user, dailyPlan);
      item = personalized.vocabulary.find((entry) => entry.id === itemId);
    }

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

    return this.contentRepository.recordVocabularyReview(userId, item, {
      hits: nextHits,
      misses: nextMisses,
      confidence: nextConfidence,
      nextReviewAt,
    });
  }
}
