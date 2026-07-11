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
    const { user, dailyPlan, progress } = await this.dailyPlanService.createOrGetTodayPlan(userId);
    const [
      content,
      settings,
      realProgressStats,
      recentSpeakingAttempts,
      reviewQueue,
    ] = await Promise.all([
      this.contentRepository.getLearningContent(userId),
      this.settingsRepository.findOrCreate(userId),
      this.aiRepository.getProgressStats(userId),
      this.aiRepository.getRecentSpeakingAttempts(userId),
      this.contentRepository.getDueReviewItems(userId),
    ]);
    const personalizedContent = this.contentRepository.personalizeForPlan(content, user, dailyPlan);

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
      ...personalizedContent,
    };
  }
}
