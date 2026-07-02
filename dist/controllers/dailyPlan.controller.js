"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPlanController = void 0;
class DailyPlanController {
    constructor(dailyPlanService) {
        this.dailyPlanService = dailyPlanService;
        this.getToday = async (request, response) => {
            const userId = typeof request.query.userId === "string" ? request.query.userId : undefined;
            const result = await this.dailyPlanService.createOrGetTodayPlan(userId);
            response.json(result);
        };
        this.completeBlock = async (request, response) => {
            const { planId, blockId, userId } = request.body;
            if (!planId || !blockId) {
                response.status(400).json({ message: "planId and blockId are required" });
                return;
            }
            const result = await this.dailyPlanService.completeBlock(planId, blockId, userId);
            if (!result) {
                response.status(404).json({ message: "Study block not found" });
                return;
            }
            response.json(result);
        };
    }
}
exports.DailyPlanController = DailyPlanController;
