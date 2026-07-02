import { Request, Response } from "express";
import { DailyPlanService } from "../services/dailyPlan.service";

export class DailyPlanController {
  constructor(private readonly dailyPlanService: DailyPlanService) {}

  getToday = async (request: Request, response: Response) => {
    const userId = typeof request.query.userId === "string" ? request.query.userId : undefined;
    const result = await this.dailyPlanService.createOrGetTodayPlan(userId);
    response.json(result);
  };

  completeBlock = async (request: Request, response: Response) => {
    const { planId, blockId, userId } = request.body as {
      planId?: string;
      blockId?: string;
      userId?: string;
    };

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
