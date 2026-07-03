"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
class ContentService {
    constructor(contentRepository, dailyPlanService) {
        this.contentRepository = contentRepository;
        this.dailyPlanService = dailyPlanService;
    }
    async getBootstrap(userId) {
        const [{ user, dailyPlan, progress }, content] = await Promise.all([
            this.dailyPlanService.createOrGetTodayPlan(userId),
            this.contentRepository.getLearningContent(),
        ]);
        return {
            user,
            dailyPlan,
            progress,
            goal: {
                id: `goal-${user.id}`,
                label: `Reach confident B1 speaking for work`,
                targetLevel: "B1",
                progress: progress.consistencyScore,
            },
            ...content,
        };
    }
}
exports.ContentService = ContentService;
