import { ContentRepository } from "../repositories/content.repository";
import { DailyPlanService } from "./dailyPlan.service";

export class ContentService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly dailyPlanService: DailyPlanService
  ) {}

  async getBootstrap(userId: string) {
    const [{ user, dailyPlan, progress }, content] = await Promise.all([
      this.dailyPlanService.createOrGetTodayPlan(userId),
      this.contentRepository.getLearningContent(),
    ]);

    return {
      user,
      dailyPlan,
      progress,
      goal: {
        id: `goal-${user.id}`,
        label: `Reach confident B1 speaking for work`,
        targetLevel: "B1",
        progress: progress.consistencyScore,
      },
      ...content,
    };
  }
}
