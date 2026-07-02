import { dashboardMock } from "../data/mockData";
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

  async buildPlan(input: OnboardingInput) {
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
      ...dashboardMock.user,
      name: input.name,
      currentLevel: level,
      dailyMinutes: input.dailyMinutes,
      profession: input.profession,
      primaryGoal: input.objective,
      mainDifficulty: input.difficulty,
    };
    const { dailyPlan, progress, user } = await this.dailyPlanService.createPlanForProfile(profile);

    return {
      profile: {
        ...profile,
        id: user.id,
        email: user.email,
      },
      suggestedPlan: {
        ...dailyPlan,
        focus: dailyPlan.focus || focus,
      },
      progress,
    };
  }
}
