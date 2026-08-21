"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
class ContentService {
    constructor(contentRepository, dailyPlanService, settingsRepository, aiRepository, practiceRepository, progressService, userGoalRepository, learningStateService, dailyAiPlannerService) {
        this.contentRepository = contentRepository;
        this.dailyPlanService = dailyPlanService;
        this.settingsRepository = settingsRepository;
        this.aiRepository = aiRepository;
        this.practiceRepository = practiceRepository;
        this.progressService = progressService;
        this.userGoalRepository = userGoalRepository;
        this.learningStateService = learningStateService;
        this.dailyAiPlannerService = dailyAiPlannerService;
        this.blueprintInFlight = new Map();
    }
    async getBootstrap(userId) {
        const { user, dailyPlan, progress } = await this.dailyPlanService.createOrGetTodayPlan(userId);
        const [content, settings, realProgressStats, recentSpeakingAttempts, reviewQueue, completionState, goal, presentedContent,] = await Promise.all([
            this.contentRepository.getLearningContent(userId),
            this.settingsRepository.findOrCreate(userId),
            this.progressService?.getProgressStats(userId) ?? this.aiRepository.getProgressStats(userId),
            this.aiRepository.getRecentSpeakingAttempts(userId),
            this.contentRepository.getDueReviewItems(userId),
            this.practiceRepository.getUserCompletionState(userId),
            this.userGoalRepository?.findByUserId(userId) ?? Promise.resolve(null),
            this.contentRepository.getPresentedContent(userId),
        ]);
        const recalculatedProgress = await this.progressService?.recalculateSkillScores(userId, user.currentLevel);
        const effectiveProgress = recalculatedProgress ?? progress;
        const planWithBlueprint = await this.ensureBlueprint({ dailyPlan, user, progress: effectiveProgress, reviewQueue });
        const personalizedContent = this.contentRepository.personalizeForPlan(content, user, planWithBlueprint, {
            completedActivities: completionState.completedActivities,
            listeningAttempts: completionState.listeningAttempts,
            recentSpeakingAttempts,
            dueReviewItems: reviewQueue,
            // A page reload must preserve today's selection. Yesterday's exposures,
            // however, make an item known for tomorrow's eligibility calculation.
            presentedContent: presentedContent.filter((item) => item.completedAt.slice(0, 10) < dailyPlan.date),
        });
        await this.contentRepository.recordDailyPresentation(userId, personalizedContent);
        return {
            user,
            settings,
            dailyPlan: planWithBlueprint,
            progress: effectiveProgress,
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
                    progress: effectiveProgress.consistencyScore,
                }
                : null,
            requiresGoalSetup: !goal,
            ...personalizedContent,
        };
    }
    async ensureBlueprint(input) {
        if (input.dailyPlan.aiBlueprint || !this.learningStateService || !this.dailyAiPlannerService)
            return input.dailyPlan;
        const key = input.dailyPlan.id;
        const existing = this.blueprintInFlight.get(key);
        if (existing)
            return existing;
        const generation = (async () => {
            try {
                return await this.dailyPlanService.saveAiBlueprint(input.dailyPlan, await this.dailyAiPlannerService.create(input.dailyPlan, await this.learningStateService.build({ user: input.user, progress: input.progress, dueReviews: input.reviewQueue, recentPlans: [input.dailyPlan] })));
            }
            finally {
                this.blueprintInFlight.delete(key);
            }
        })();
        this.blueprintInFlight.set(key, generation);
        return generation;
    }
}
exports.ContentService = ContentService;
