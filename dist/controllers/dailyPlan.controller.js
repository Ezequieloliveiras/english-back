"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPlanController = void 0;
class DailyPlanController {
    constructor(dailyPlanService, activityGenerationService) {
        this.dailyPlanService = dailyPlanService;
        this.activityGenerationService = activityGenerationService;
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
        this.getActivity = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            if (!this.activityGenerationService) {
                response.status(503).json({ message: "AI activity generation is unavailable" });
                return;
            }
            try {
                const { dailyPlan } = await this.dailyPlanService.createOrGetTodayPlan(request.auth.userId);
                response.json(await this.activityGenerationService.getOrGenerate(dailyPlan, String(request.params.activityId)));
            }
            catch (error) {
                response.status(404).json({ message: error instanceof Error ? error.message : "Activity not found" });
            }
        };
    }
}
exports.DailyPlanController = DailyPlanController;
