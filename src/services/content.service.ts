import { ContentRepository } from "../repositories/content.repository";
import { AiRepository } from "../repositories/ai.repository";
import { PracticeRepository } from "../repositories/practice.repository";
import { SettingsRepository } from "../repositories/settings.repository";
import { UserGoalRepository } from "../repositories/userGoal.repository";
import { DailyPlanService } from "./dailyPlan.service";
import { ProgressService } from "./progress.service";

export class ContentService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly dailyPlanService: DailyPlanService,
    private readonly settingsRepository: SettingsRepository,
    private readonly aiRepository: AiRepository,
    private readonly practiceRepository: PracticeRepository,
    private readonly progressService?: ProgressService,
    private readonly userGoalRepository?: UserGoalRepository
  ) {}

  async getBootstrap(userId: string) {
    const { user, dailyPlan, progress } = await this.dailyPlanService.createOrGetTodayPlan(userId);
    const [
      content,
      settings,
      realProgressStats,
      recentSpeakingAttempts,
      reviewQueue,
      completionState,
      goal,
    ] = await Promise.all([
      this.contentRepository.getLearningContent(userId),
      this.settingsRepository.findOrCreate(userId),
      this.progressService?.getProgressStats(userId) ?? this.aiRepository.getProgressStats(userId),
      this.aiRepository.getRecentSpeakingAttempts(userId),
      this.contentRepository.getDueReviewItems(userId),
      this.practiceRepository.getUserCompletionState(userId),
      this.userGoalRepository?.findByUserId(userId) ?? Promise.resolve(null),
    ]);
    const recalculatedProgress = await this.progressService?.recalculateSkillScores(userId, user.currentLevel);
    const personalizedContent = this.contentRepository.personalizeForPlan(content, user, dailyPlan, {
      completedActivities: completionState.completedActivities,
    });

    return {
      user,
      settings,
      dailyPlan,
      progress: recalculatedProgress ?? progress,
      realProgressStats,
      recentSpeakingAttempts,
      completedActivities: completionState.completedActivities,
      listeningAttempts: completionState.listeningAttempts,
      reviewQueue,
      goal: goal
        ? {
            id: goal.id,
            primaryGoal: goal.primaryGoal,
            label: goal.primaryGoal,
            targetLevel: goal.targetLevel,
            professionalContext: goal.professionalContext,
            deadline: goal.deadline,
            progress: (recalculatedProgress ?? progress).consistencyScore,
          }
        : null,
      requiresGoalSetup: !goal,
      ...personalizedContent,
    };
  }
}
