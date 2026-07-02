import { Request, Response } from "express";
import { EnglishLevel, UserProfile } from "../types";
import { OnboardingService } from "../services/onboarding.service";

export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  createPlan = async (request: Request, response: Response) => {
    const { name, objective, level, dailyMinutes, profession, difficulty } = request.body as {
      name?: string;
      objective?: string;
      level?: string;
      dailyMinutes?: number;
      profession?: string;
      difficulty?: string;
    };

    if (!name || !objective || !level || !dailyMinutes || !profession || !difficulty) {
      response.status(400).json({ message: "Missing onboarding fields" });
      return;
    }

    const result = await this.onboardingService.buildPlan({
      name,
      objective,
      level: level as EnglishLevel,
      dailyMinutes,
      profession,
      difficulty: difficulty as UserProfile["mainDifficulty"],
    });

    response.status(201).json(result);
  };
}
