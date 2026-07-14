"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPlanController = void 0;
class DailyPlanController {
    constructor(dailyPlanService) {
        this.dailyPlanService = dailyPlanService;
        this.getToday = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const result = await this.dailyPlanService.createOrGetTodayPlan(request.auth.userId);
            response.json(result);
        };
        this.advanceToday = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const result = await this.dailyPlanService.advanceTodayPlan(request.auth.userId);
            response.status(201).json(result);
        };
        this.completeBlock = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const { planId, blockId } = request.body;
            if (!planId || !blockId) {
                response.status(400).json({ message: "planId and blockId are required" });
                return;
            }
            const result = await this.dailyPlanService.completeBlock(planId, blockId, request.auth.userId);
            response.status(result.status).json(result.body);
        };
    }
}
exports.DailyPlanController = DailyPlanController;
