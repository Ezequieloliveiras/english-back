import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { EnglishLevel, UserProfile } from "../types";
import { ProfilePlanService } from "../services/profilePlan.service";

export class ProfilePlanController {
  constructor(private readonly profilePlanService: ProfilePlanService) {}

  createPlan = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const { name, objective, level, dailyMinutes, profession, professionalFocusMode, difficulty } = request.body as {
      name?: string;
      objective?: string;
      level?: string;
      dailyMinutes?: number;
      profession?: string;
      professionalFocusMode?: UserProfile["professionalFocusMode"];
      difficulty?: string;
    };

    if (!name || !objective || !level || !dailyMinutes || !profession || !difficulty) {
      response.status(400).json({ message: "Missing profile plan fields" });
      return;
    }

    const result = await this.profilePlanService.buildPlan(request.auth.userId, {
      name,
      objective,
      level: level as EnglishLevel,
      dailyMinutes,
      profession,
      professionalFocusMode,
      difficulty: difficulty as UserProfile["mainDifficulty"],
    });

    response.status(result.status).json(result.body);
  };
}
