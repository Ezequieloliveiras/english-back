"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilePlanController = void 0;
class ProfilePlanController {
    constructor(profilePlanService) {
        this.profilePlanService = profilePlanService;
        this.updateProfile = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const { name, objective, level, dailyMinutes, profession, professionalFocusMode, difficulty } = request.body;
            if (!name || !objective || !level || !dailyMinutes || !profession || !difficulty) {
                response.status(400).json({ message: "Missing profile fields" });
                return;
            }
            const result = await this.profilePlanService.updateProfile(request.auth.userId, {
                name,
                objective,
                level: level,
                dailyMinutes,
                profession,
                professionalFocusMode,
                difficulty: difficulty,
            });
            response.status(result.status).json(result.body);
        };
        this.createPlan = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const { name, objective, level, dailyMinutes, profession, professionalFocusMode, difficulty } = request.body;
            if (!name || !objective || !level || !dailyMinutes || !profession || !difficulty) {
                response.status(400).json({ message: "Missing profile plan fields" });
                return;
            }
            const result = await this.profilePlanService.buildPlan(request.auth.userId, {
                name,
                objective,
                level: level,
                dailyMinutes,
                profession,
                professionalFocusMode,
                difficulty: difficulty,
            });
            response.status(result.status).json(result.body);
        };
    }
}
exports.ProfilePlanController = ProfilePlanController;
