"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingController = void 0;
class OnboardingController {
    constructor(onboardingService) {
        this.onboardingService = onboardingService;
        this.createPlan = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const { name, objective, level, dailyMinutes, profession, difficulty } = request.body;
            if (!name || !objective || !level || !dailyMinutes || !profession || !difficulty) {
                response.status(400).json({ message: "Missing onboarding fields" });
                return;
            }
            const result = await this.onboardingService.buildPlan(request.auth.userId, {
                name,
                objective,
                level: level,
                dailyMinutes,
                profession,
                difficulty: difficulty,
            });
            response.status(201).json(result);
        };
    }
}
exports.OnboardingController = OnboardingController;
