"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
class ContentService {
    constructor(contentRepository, dailyPlanService, settingsRepository, aiRepository) {
        this.contentRepository = contentRepository;
        this.dailyPlanService = dailyPlanService;
        this.settingsRepository = settingsRepository;
        this.aiRepository = aiRepository;
    }
    async getBootstrap(userId) {
        const { user, dailyPlan, progress } = await this.dailyPlanService.createOrGetTodayPlan(userId);
        const [content, settings, realProgressStats, recentSpeakingAttempts, reviewQueue,] = await Promise.all([
            this.contentRepository.getLearningContent(userId),
            this.settingsRepository.findOrCreate(userId),
            this.aiRepository.getProgressStats(userId),
            this.aiRepository.getRecentSpeakingAttempts(userId),
            this.contentRepository.getDueReviewItems(userId),
        ]);
        const personalizedContent = this.contentRepository.personalizeForPlan(content, user, dailyPlan);
        return {
            user,
            settings,
            dailyPlan,
            progress,
            realProgressStats,
            recentSpeakingAttempts,
            reviewQueue,
            goal: {
                id: `goal-${user.id}`,
                label: `Reach confident B1 speaking for work`,
                targetLevel: "B1",
                progress: progress.consistencyScore,
            },
            ...personalizedContent,
        };
    }
}
exports.ContentService = ContentService;
