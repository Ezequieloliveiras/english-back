import mongoose from "mongoose";
import { ContentExposureModel } from "../models/contentExposure.model";
import { ListeningAttemptModel } from "../models/listeningAttempt.model";
import { ReviewScheduleModel } from "../models/reviewSchedule.model";
import { SpeakingAttemptModel } from "../models/speakingAttempt.model";
import { VocabularyItemModel } from "../models/vocabularyItem.model";
import { PracticeActivityModel } from "../models/practiceActivity.model";
import { UserGoalModel } from "../models/userGoal.model";
import { DailyPlan, ProgressSnapshot, UserProfile, VocabularyItem } from "../types";
import { assessProficiency, ProficiencyAssessment } from "./curriculum.service";

export const LEARNING_STATE_LIMITS = { semanticHistory: 14, attempts: 12, reviews: 8 } as const;

export interface LearningState {
  level: UserProfile["currentLevel"];
  targetLevel?: string;
  progress: ProgressSnapshot;
  recentSemanticHistory: Array<{ module: string; semantic: unknown }>;
  dueReviews: Array<{ id: string; phrase: string; misses: number }>;
  listening: { recentScores: number[]; weakPatterns: string[] };
  speaking: { recentScores: number[]; weakPatterns: string[] };
  recentPlans: Array<Pick<DailyPlan, "date" | "focus">>;
  proficiency: ProficiencyAssessment;
}

/** Builds one bounded pedagogical summary; no item-by-item queries. */
export class LearningStateService {
  async build(input: { user: UserProfile; progress: ProgressSnapshot; dueReviews: VocabularyItem[]; recentPlans: DailyPlan[] }): Promise<LearningState> {
    const fallbackAssessment = assessProficiency({ profile: input.user, progress: input.progress, listening: [], speaking: [], vocabulary: [], completedInteractions: 0 });
    const fallback: LearningState = {
      level: input.user.currentLevel, progress: input.progress,
      recentSemanticHistory: [], dueReviews: input.dueReviews.slice(0, LEARNING_STATE_LIMITS.reviews).map((item) => ({ id: item.id, phrase: item.phrase, misses: item.misses })),
      listening: { recentScores: [], weakPatterns: [] }, speaking: { recentScores: [], weakPatterns: [] },
      recentPlans: input.recentPlans.slice(0, 5).map((plan) => ({ date: plan.date, focus: plan.focus })),
      proficiency: fallbackAssessment,
    };
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(input.user.id)) return fallback;
    const userId = new mongoose.Types.ObjectId(input.user.id);
    const [goal, exposures, listening, speaking, vocabulary, interactions] = await Promise.all([
      UserGoalModel.findOne({ userId }).select("targetLevel").lean(),
      ContentExposureModel.find({ userId, semantic: { $exists: true } }).sort({ lastPresentedAt: -1 }).limit(LEARNING_STATE_LIMITS.semanticHistory).select("type semantic").lean(),
      ListeningAttemptModel.find({ userId }).sort({ completedAt: -1 }).limit(LEARNING_STATE_LIMITS.attempts).select("comprehensionCorrect replayCount unknownWords").lean(),
      SpeakingAttemptModel.find({ userId }).sort({ createdAt: -1 }).limit(LEARNING_STATE_LIMITS.attempts).select("pronunciationScore naturalnessScore fluencyScore correctedWords").lean(),
      VocabularyItemModel.find({ userId }).select("timesPracticed timesCorrect hits misses").limit(80).lean(),
      PracticeActivityModel.countDocuments({ userId, type: { $in: ["conversation", "think-in-english", "developer-mode"] } }),
    ]);
    const proficiency = assessProficiency({
      profile: input.user,
      progress: input.progress,
      listening,
      speaking,
      vocabulary,
      completedInteractions: interactions,
    });
    return {
      ...fallback,
      targetLevel: goal?.targetLevel,
      recentSemanticHistory: exposures.map((item) => ({ module: item.type, semantic: item.semantic })),
      listening: {
        recentScores: listening.map((item) => item.comprehensionCorrect ? 100 : 0),
        weakPatterns: [...new Set(listening.flatMap((item) => item.unknownWords ?? []).filter(Boolean))].slice(0, 8),
      },
      speaking: {
        recentScores: speaking.map((item) => Number(item.pronunciationScore ?? 0) * 10),
        weakPatterns: [...new Set(speaking.flatMap((item) => item.correctedWords ?? []).filter(Boolean))].slice(0, 8),
      },
      proficiency,
    };
  }
}
