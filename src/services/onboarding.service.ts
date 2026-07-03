import { DailyPlanService } from "./dailyPlan.service";
import { EnglishLevel, UserProfile } from "../types";

interface OnboardingInput {
  name: string;
  objective: string;
  level: EnglishLevel;
  dailyMinutes: number;
  profession: string;
  difficulty: UserProfile["mainDifficulty"];
}

export class OnboardingService {
  constructor(private readonly dailyPlanService: DailyPlanService) {}

  async buildPlan(userId: string, input: OnboardingInput) {
    const level = input.level.toUpperCase() as EnglishLevel;
    const focus =
      input.difficulty === "speaking"
        ? "Build spoken confidence with low-friction practice."
        : input.difficulty === "listening"
          ? "Train your ear with short, comprehensible dialogues."
          : input.difficulty === "pronunciation"
            ? "Improve clarity, stress, and connected speech."
            : "Learn reusable phrases in context.";

    const profile = {
      name: input.name,
      currentLevel: level,
      dailyMinutes: input.dailyMinutes,
      profession: input.profession,
      primaryGoal: input.objective,
      mainDifficulty: input.difficulty,
    };
    const { dailyPlan, progress, user } = await this.dailyPlanService.createPlanForProfile(userId, profile);

    return {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        currentLevel: user.currentLevel,
        dailyMinutes: user.dailyMinutes,
        profession: user.profession,
        primaryGoal: user.primaryGoal,
        mainDifficulty: user.mainDifficulty,
      },
      suggestedPlan: {
        ...dailyPlan,
        focus: dailyPlan.focus || focus,
      },
      progress,
    };
  }
}
