"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
class ContentService {
    constructor(contentRepository, dailyPlanService, settingsRepository, aiRepository, practiceRepository, progressService, userGoalRepository) {
        this.contentRepository = contentRepository;
        this.dailyPlanService = dailyPlanService;
        this.settingsRepository = settingsRepository;
        this.aiRepository = aiRepository;
        this.practiceRepository = practiceRepository;
        this.progressService = progressService;
        this.userGoalRepository = userGoalRepository;
    }
    async getBootstrap(userId) {
        const { user, dailyPlan, progress } = await this.dailyPlanService.createOrGetTodayPlan(userId);
        const [content, settings, realProgressStats, recentSpeakingAttempts, reviewQueue, completionState, goal,] = await Promise.all([
            this.contentRepository.getLearningContent(userId),
            this.settingsRepository.findOrCreate(userId),
            this.progressService?.getProgressStats(userId) ?? this.aiRepository.getProgressStats(userId),
            this.aiRepository.getRecentSpeakingAttempts(userId),
            this.contentRepository.getDueReviewItems(userId),
            this.practiceRepository.getUserCompletionState(userId),
            this.userGoalRepository?.findByUserId(userId) ?? Promise.resolve(null),
        ]);
        const recalculatedProgress = await this.progressService?.recalculateSkillScores(userId, user.currentLevel);
        const personalizedContent = this.contentRepository.personalizeForPlan(content, user, dailyPlan, {
            completedActivities: completionState.completedActivities,
        });
        return {
            user,
            settings,
            dailyPlan,
            progress: recalculatedProgress ?? progress,
            realProgressStats,
            recentSpeakingAttempts,
            completedActivities: completionState.completedActivities,
            listeningAttempts: completionState.listeningAttempts,
            reviewQueue,
            goal: goal
                ? {
                    id: goal.id,
                    primaryGoal: goal.primaryGoal,
                    label: goal.primaryGoal,
                    targetLevel: goal.targetLevel,
                    professionalContext: goal.professionalContext,
                    deadline: goal.deadline,
                    progress: (recalculatedProgress ?? progress).consistencyScore,
                }
                : null,
            requiresGoalSetup: !goal,
            ...personalizedContent,
        };
    }
}
exports.ContentService = ContentService;
