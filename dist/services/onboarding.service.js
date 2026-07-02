"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const mockData_1 = require("../data/mockData");
class OnboardingService {
    constructor(dailyPlanService) {
        this.dailyPlanService = dailyPlanService;
    }
    async buildPlan(input) {
        const level = input.level.toUpperCase();
        const focus = input.difficulty === "speaking"
            ? "Build spoken confidence with low-friction practice."
            : input.difficulty === "listening"
                ? "Train your ear with short, comprehensible dialogues."
                : input.difficulty === "pronunciation"
                    ? "Improve clarity, stress, and connected speech."
                    : "Learn reusable phrases in context.";
        const profile = {
            ...mockData_1.dashboardMock.user,
            name: input.name,
            currentLevel: level,
            dailyMinutes: input.dailyMinutes,
            profession: input.profession,
            primaryGoal: input.objective,
            mainDifficulty: input.difficulty,
        };
        const { dailyPlan, progress, user } = await this.dailyPlanService.createPlanForProfile(profile);
        return {
            profile: {
                ...profile,
                id: user.id,
                email: user.email,
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
