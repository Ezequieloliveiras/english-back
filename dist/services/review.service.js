"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const reviewScheduler_1 = require("../utils/reviewScheduler");
class ReviewService {
    constructor(contentRepository, dailyPlanService) {
        this.contentRepository = contentRepository;
        this.dailyPlanService = dailyPlanService;
    }
    async recordReview(userId, itemId, wasCorrect) {
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
        const nextConfidence = Math.max(10, Math.min(100, item.confidence + (wasCorrect ? 8 : -12)));
        const nextReviewAt = (0, reviewScheduler_1.calculateNextReviewDate)(nextHits, wasCorrect).toISOString();
        const updated = await this.contentRepository.recordVocabularyReview(userId, item, {
            hits: nextHits,
            misses: nextMisses,
            confidence: nextConfidence,
            nextReviewAt,
        });
        const isReviewQueueItem = item.category.toLowerCase().includes("review");
        await this.dailyPlanService.recordBlockEvidence({
            userId,
            blockType: isReviewQueueItem ? "review" : "vocabulary",
            evidenceType: isReviewQueueItem ? "retention_review" : "vocabulary_recall",
            evidenceRef: itemId,
        });
        return updated;
    }
}
exports.ReviewService = ReviewService;
