import { ContentRepository } from "../repositories/content.repository";
import { AiRepository } from "../repositories/ai.repository";
import { SettingsRepository } from "../repositories/settings.repository";
import { DailyPlanService } from "./dailyPlan.service";

export class ContentService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly dailyPlanService: DailyPlanService,
    private readonly settingsRepository: SettingsRepository,
    private readonly aiRepository: AiRepository
  ) {}

  async getBootstrap(userId: string) {
    const [
      { user, dailyPlan, progress },
      content,
      settings,
      realProgressStats,
      recentSpeakingAttempts,
      reviewQueue,
    ] = await Promise.all([
      this.dailyPlanService.createOrGetTodayPlan(userId),
      this.contentRepository.getLearningContent(userId),
      this.settingsRepository.findOrCreate(userId),
      this.aiRepository.getProgressStats(userId),
      this.aiRepository.getRecentSpeakingAttempts(userId),
      this.contentRepository.getDueReviewItems(userId),
    ]);

    return {
      user,
      settings,
      dailyPlan,
      progress,
      realProgressStats,
      recentSpeakingAttempts,
      reviewQueue,
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
