import { ProgressRepository } from "../repositories/progress.repository";
import { DailyPlan, EnglishLevel, ProgressSnapshot, StudyBlock } from "../types";

type SpeakingAttemptProgressInput = {
  userId: string;
  attemptId: string;
  expectedText: string;
  transcribedText: string;
  rawTranscript?: string;
  normalizedTranscript?: string;
  correctedText?: string;
  translated?: boolean;
  detectedLanguage?: string;
  targetLanguage?: string;
  transcriptionLanguage?: string;
  feedbackPtBr?: string;
  wordAnalysis?: unknown[];
  preferencesVersion?: number;
  wordsSpokenCount: number;
  correctedWords: string[];
  correctionCount: number;
  durationSeconds?: number;
  mainImprovementArea: string;
  pronunciationScore: number;
  level: EnglishLevel;
};

type ListeningAttemptProgressInput = {
  userId: string;
  attemptId: string;
  exerciseId: string;
  level: EnglishLevel;
  minutes?: number;
};

const minutesFromSeconds = (seconds?: number) => {
  if (!seconds || seconds <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(seconds / 60));
};

export class ProgressService {
  constructor(private readonly progressRepository: ProgressRepository) {}

  findOrCreateDailyProgress(userId: string, level: EnglishLevel) {
    return this.progressRepository.findOrCreateDailyProgress(userId, level);
  }

  getProgressStats(userId: string) {
    return this.progressRepository.getProgressStats(userId);
  }

  recalculateSkillScores(userId: string, level: EnglishLevel) {
    return this.progressRepository.recalculateSkillScores(userId, level);
  }

  async recordBlockCompleted(input: {
    userId: string;
    plan: DailyPlan;
    block: StudyBlock;
    previousProgress: ProgressSnapshot;
    completedPlanNow: boolean;
  }) {
    const eventKey = `daily-block:${input.plan.id}:${input.block.id}:completed`;
    const event = await this.progressRepository.recordEvent({
      userId: input.userId,
      eventKey,
      type: "daily_block_completed",
      source: "daily_plan",
      sourceId: `${input.plan.id}:${input.block.id}`,
      payload: {
        planId: input.plan.id,
        blockId: input.block.id,
        blockType: input.block.type,
        durationMinutes: input.block.durationMinutes,
      },
    });

    if (!event.created) {
      return input.previousProgress;
    }

    const completedBlocks = input.plan.blocks.filter((block) => block.status === "completed").length;
    const consistencyScore = input.plan.blocks.length
      ? Math.round((completedBlocks / input.plan.blocks.length) * 100)
      : 0;
    const nextProgress: ProgressSnapshot = {
      ...input.previousProgress,
      studiedMinutesToday: input.previousProgress.studiedMinutesToday + input.block.durationMinutes,
      streakDays: input.completedPlanNow ? input.previousProgress.streakDays + 1 : input.previousProgress.streakDays,
      consistencyScore: Math.max(input.previousProgress.consistencyScore, consistencyScore),
      completedBlocks: (input.previousProgress.completedBlocks ?? 0) + 1,
      completedPlans: (input.previousProgress.completedPlans ?? 0) + (input.completedPlanNow ? 1 : 0),
    };

    await this.progressRepository.incrementAccumulatedStats(input.userId, {
      minutes: input.block.durationMinutes,
    });

    return this.progressRepository.updateDailyProgress(input.userId, nextProgress);
  }

  async recordSpeakingAttempt(input: SpeakingAttemptProgressInput) {
    const event = await this.progressRepository.recordEvent({
      userId: input.userId,
      eventKey: `speaking-attempt:${input.attemptId}:stats`,
      type: "speaking_attempt_recorded",
      source: "speaking_attempt",
      sourceId: input.attemptId,
      payload: {
        expectedText: input.expectedText,
        wordsSpokenCount: input.wordsSpokenCount,
        correctionCount: input.correctionCount,
      },
    });

    if (!event.created) {
      return this.progressRepository.getProgressStats(input.userId);
    }

    const stats = await this.progressRepository.incrementAccumulatedStats(input.userId, {
      minutes: minutesFromSeconds(input.durationSeconds),
      wordsPronounced: input.wordsSpokenCount,
      phrasesPracticed: 1,
      speakingSessions: 1,
      recordings: 1,
      corrections: input.correctionCount,
      transcribedText: input.transcribedText,
      missedWords: input.correctedWords,
      mainImprovementArea: input.mainImprovementArea,
    });
    await this.progressRepository.recalculateSkillScores(input.userId, input.level);

    return stats;
  }

  async recordListeningAttempt(input: ListeningAttemptProgressInput) {
    const event = await this.progressRepository.recordEvent({
      userId: input.userId,
      eventKey: `listening-attempt:${input.attemptId}:stats`,
      type: "listening_attempt_recorded",
      source: "listening_attempt",
      sourceId: input.attemptId,
      payload: {
        exerciseId: input.exerciseId,
      },
    });

    if (event.created) {
      await this.progressRepository.incrementAccumulatedStats(input.userId, {
        minutes: input.minutes ?? 1,
      });
    }

    return this.progressRepository.recalculateSkillScores(input.userId, input.level);
  }

  async recordVocabularyReview(input: {
    userId: string;
    itemId: string;
    level: EnglishLevel;
    wasCorrect: boolean;
    reviewCount: number;
  }) {
    const event = await this.progressRepository.recordEvent({
      userId: input.userId,
      eventKey: `vocabulary-review:${input.itemId}:${input.reviewCount}`,
      type: "vocabulary_review_recorded",
      source: "vocabulary_review",
      sourceId: input.itemId,
      payload: {
        wasCorrect: input.wasCorrect,
      },
    });

    if (event.created) {
      await this.progressRepository.incrementAccumulatedStats(input.userId, {
        minutes: 1,
      });
    }

    return this.progressRepository.recalculateSkillScores(input.userId, input.level);
  }
}
