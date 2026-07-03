"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const reviewScheduler_1 = require("../utils/reviewScheduler");
class ReviewService {
    constructor(contentRepository) {
        this.contentRepository = contentRepository;
    }
    async recordReview(userId, itemId, wasCorrect) {
        const payload = await this.contentRepository.getLearningContent();
        const item = payload.vocabulary.find((entry) => entry.id === itemId);
        if (!item) {
            return null;
        }
        const nextHits = wasCorrect ? item.hits + 1 : item.hits;
        const nextMisses = wasCorrect ? item.misses : item.misses + 1;
        const nextConfidence = Math.max(10, Math.min(100, item.confidence + (wasCorrect ? 8 : -12)));
        const nextReviewAt = (0, reviewScheduler_1.calculateNextReviewDate)(nextHits, wasCorrect).toISOString();
        return this.contentRepository.updateVocabularyReview(userId, itemId, {
            hits: nextHits,
            misses: nextMisses,
            confidence: nextConfidence,
            nextReviewAt,
        });
    }
}
exports.ReviewService = ReviewService;
