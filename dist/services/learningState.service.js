"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningStateService = exports.LEARNING_STATE_LIMITS = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const contentExposure_model_1 = require("../models/contentExposure.model");
const listeningAttempt_model_1 = require("../models/listeningAttempt.model");
const speakingAttempt_model_1 = require("../models/speakingAttempt.model");
const userGoal_model_1 = require("../models/userGoal.model");
exports.LEARNING_STATE_LIMITS = { semanticHistory: 14, attempts: 12, reviews: 8 };
/** Builds one bounded pedagogical summary; no item-by-item queries. */
class LearningStateService {
    async build(input) {
        const fallback = {
            level: input.user.currentLevel, progress: input.progress,
            recentSemanticHistory: [], dueReviews: input.dueReviews.slice(0, exports.LEARNING_STATE_LIMITS.reviews).map((item) => ({ id: item.id, phrase: item.phrase, misses: item.misses })),
            listening: { recentScores: [], weakPatterns: [] }, speaking: { recentScores: [], weakPatterns: [] },
            recentPlans: input.recentPlans.slice(0, 5).map((plan) => ({ date: plan.date, focus: plan.focus })),
        };
        if (mongoose_1.default.connection.readyState !== 1 || !mongoose_1.default.Types.ObjectId.isValid(input.user.id))
            return fallback;
        const userId = new mongoose_1.default.Types.ObjectId(input.user.id);
        const [goal, exposures, listening, speaking] = await Promise.all([
            userGoal_model_1.UserGoalModel.findOne({ userId }).select("targetLevel").lean(),
            contentExposure_model_1.ContentExposureModel.find({ userId, semantic: { $exists: true } }).sort({ lastPresentedAt: -1 }).limit(exports.LEARNING_STATE_LIMITS.semanticHistory).select("type semantic").lean(),
            listeningAttempt_model_1.ListeningAttemptModel.find({ userId }).sort({ completedAt: -1 }).limit(exports.LEARNING_STATE_LIMITS.attempts).select("comprehensionCorrect replayCount unknownWords").lean(),
            speakingAttempt_model_1.SpeakingAttemptModel.find({ userId }).sort({ createdAt: -1 }).limit(exports.LEARNING_STATE_LIMITS.attempts).select("pronunciationScore correctedWords").lean(),
        ]);
        return {
            ...fallback,
            targetLevel: goal?.targetLevel,
            recentSemanticHistory: exposures.map((item) => ({ module: item.type, semantic: item.semantic })),
            listening: {
                recentScores: listening.map((item) => item.comprehensionCorrect ? 100 : 0),
                weakPatterns: [...new Set(listening.flatMap((item) => item.unknownWords ?? []).filter(Boolean))].slice(0, 8),
            },
            speaking: {
                recentScores: speaking.map((item) => Number(item.pronunciationScore ?? 0) * 10),
                weakPatterns: [...new Set(speaking.flatMap((item) => item.correctedWords ?? []).filter(Boolean))].slice(0, 8),
            },
        };
    }
}
exports.LearningStateService = LearningStateService;
