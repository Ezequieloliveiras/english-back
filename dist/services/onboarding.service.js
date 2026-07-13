"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
class OnboardingService {
    constructor(dailyPlanService) {
        this.dailyPlanService = dailyPlanService;
    }
    async buildPlan(userId, input) {
        const level = input.level.toUpperCase();
        const focus = input.difficulty === "speaking"
            ? "Build spoken confidence with low-friction practice."
            : input.difficulty === "listening"
                ? "Train your ear with short, comprehensible dialogues."
                : input.difficulty === "pronunciation"
                    ? "Improve clarity, stress, and connected speech."
                    : "Learn reusable phrases in context.";
        const profile = {
            name: input.name,
            currentLevel: level,
            dailyMinutes: input.dailyMinutes,
            profession: input.profession,
            primaryGoal: input.objective,
            mainDifficulty: input.difficulty,
            initialSetupCompleted: true,
        };
        const { dailyPlan, progress, user } = await this.dailyPlanService.createPlanForProfile(userId, profile);
        return {
            profile: {
                id: user.id,
                name: user.name,
                email: user.email,
                currentLevel: user.currentLevel,
                dailyMinutes: user.dailyMinutes,
                profession: user.profession,
                primaryGoal: user.primaryGoal,
                mainDifficulty: user.mainDifficulty,
                initialSetupCompleted: user.initialSetupCompleted,
            },
            suggestedPlan: {
                ...dailyPlan,
                focus: dailyPlan.focus || focus,
            },
            progress,
        };
    }
}
exports.OnboardingService = OnboardingService;
