import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { DailyPlanService } from "../services/dailyPlan.service";

export class DailyPlanController {
  constructor(private readonly dailyPlanService: DailyPlanService) {}

  getToday = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await this.dailyPlanService.createOrGetTodayPlan(request.auth.userId);
    response.json(result);
  };

  completeBlock = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const { planId, blockId } = request.body as {
      planId?: string;
      blockId?: string;
    };

    if (!planId || !blockId) {
      response.status(400).json({ message: "planId and blockId are required" });
      return;
    }

    const result = await this.dailyPlanService.completeBlock(planId, blockId, request.auth.userId);

    if (!result) {
      response.status(404).json({ message: "Study block not found" });
      return;
    }

    response.json(result);
  };
}
