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
const vocabularyItem_model_1 = require("../models/vocabularyItem.model");
const practiceActivity_model_1 = require("../models/practiceActivity.model");
const userGoal_model_1 = require("../models/userGoal.model");
const curriculum_service_1 = require("./curriculum.service");
exports.LEARNING_STATE_LIMITS = { semanticHistory: 14, attempts: 12, reviews: 8 };
/** Builds one bounded pedagogical summary; no item-by-item queries. */
class LearningStateService {
    async build(input) {
        const fallbackAssessment = (0, curriculum_service_1.assessProficiency)({ profile: input.user, progress: input.progress, listening: [], speaking: [], vocabulary: [], completedInteractions: 0 });
        const fallback = {
            level: input.user.currentLevel, progress: input.progress,
            recentSemanticHistory: [], dueReviews: input.dueReviews.slice(0, exports.LEARNING_STATE_LIMITS.reviews).map((item) => ({ id: item.id, phrase: item.phrase, misses: item.misses })),
            listening: { recentScores: [], weakPatterns: [] }, speaking: { recentScores: [], weakPatterns: [] },
            recentPlans: input.recentPlans.slice(0, 5).map((plan) => ({ date: plan.date, focus: plan.focus })),
            proficiency: fallbackAssessment,
        };
        if (mongoose_1.default.connection.readyState !== 1 || !mongoose_1.default.Types.ObjectId.isValid(input.user.id))
            return fallback;
        const userId = new mongoose_1.default.Types.ObjectId(input.user.id);
        const [goal, exposures, listening, speaking, vocabulary, interactions] = await Promise.all([
            userGoal_model_1.UserGoalModel.findOne({ userId }).select("targetLevel").lean(),
            contentExposure_model_1.ContentExposureModel.find({ userId, semantic: { $exists: true } }).sort({ lastPresentedAt: -1 }).limit(exports.LEARNING_STATE_LIMITS.semanticHistory).select("type semantic").lean(),
            listeningAttempt_model_1.ListeningAttemptModel.find({ userId }).sort({ completedAt: -1 }).limit(exports.LEARNING_STATE_LIMITS.attempts).select("comprehensionCorrect replayCount unknownWords").lean(),
            speakingAttempt_model_1.SpeakingAttemptModel.find({ userId }).sort({ createdAt: -1 }).limit(exports.LEARNING_STATE_LIMITS.attempts).select("pronunciationScore naturalnessScore fluencyScore correctedWords").lean(),
            vocabularyItem_model_1.VocabularyItemModel.find({ userId }).select("timesPracticed timesCorrect hits misses").limit(80).lean(),
            practiceActivity_model_1.PracticeActivityModel.countDocuments({ userId, type: { $in: ["conversation", "think-in-english", "developer-mode"] } }),
        ]);
        const proficiency = (0, curriculum_service_1.assessProficiency)({
            profile: input.user,
            progress: input.progress,
            listening,
            speaking,
            vocabulary,
            completedInteractions: interactions,
        });
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
            proficiency,
        };
    }
}
exports.LearningStateService = LearningStateService;
