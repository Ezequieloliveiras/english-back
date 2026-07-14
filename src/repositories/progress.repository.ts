import mongoose from "mongoose";
import { ProgressEventModel } from "../models/progressEvent.model";
import { ProgressModel } from "../models/progress.model";
import { ListeningAttemptModel } from "../models/listeningAttempt.model";
import { VocabularyItemModel } from "../models/vocabularyItem.model";
import { SpeakingAttemptModel } from "../models/speakingAttempt.model";
import { UserProgressStatsModel } from "../models/userProgressStats.model";
import { EnglishLevel, ProgressSnapshot } from "../types";

export type ProgressEventInput = {
  userId: string;
  eventKey: string;
  type: string;
  source: string;
  sourceId: string;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
};

export type UserProgressStatsSnapshot = {
  totalWordsPronounced: number;
  totalPhrasesPracticed: number;
  totalSpeakingSessions: number;
  totalStudyMinutes: number;
  totalRecordings: number;
  totalCorrections: number;
  currentStreak: number;
  lastStudyDate?: string;
  mainImprovementArea: string;
  mostPracticedWords: string[];
  mostMissedWords: string[];
  weeklySpeaking: Array<{ dateLabel: string; score: number }>;
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const createEmptyStats = (): UserProgressStatsSnapshot => ({
  totalWordsPronounced: 0,
  totalPhrasesPracticed: 0,
  totalSpeakingSessions: 0,
  totalStudyMinutes: 0,
  totalRecordings: 0,
  totalCorrections: 0,
  currentStreak: 0,
  mainImprovementArea: "Not enough data yet",
  mostPracticedWords: [],
  mostMissedWords: [],
  weeklySpeaking: [],
});

const mapStats = (stats: any, weeklySpeaking: UserProgressStatsSnapshot["weeklySpeaking"]): UserProgressStatsSnapshot => ({
  totalWordsPronounced: stats.totalWordsPronounced,
  totalPhrasesPracticed: stats.totalPhrasesPracticed,
  totalSpeakingSessions: stats.totalSpeakingSessions,
  totalStudyMinutes: stats.totalStudyMinutes,
  totalRecordings: stats.totalRecordings,
  totalCorrections: stats.totalCorrections,
  currentStreak: stats.currentStreak,
  lastStudyDate: stats.lastStudyDate?.toISOString?.(),
  mainImprovementArea: stats.mainImprovementArea,
  mostPracticedWords: stats.mostPracticedWords ?? [],
  mostMissedWords: stats.mostMissedWords ?? [],
  weeklySpeaking,
});

const extractWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const previousDayKey = (date: Date) => {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return dayKey(previous);
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const calculateListeningAttemptScore = (attempt: any) => {
  const comprehension = attempt.comprehensionCorrect ? 70 : 30;
  const supportPenalty =
    (attempt.transcriptOpened ? 10 : 0) +
    (attempt.translationOpened ? 15 : 0) +
    (attempt.slowAudioUsed ? 5 : 0);
  const replayPenalty = Math.min(20, Math.max(0, Number(attempt.replayCount ?? 0)) * 4);
  const unknownWordPenalty = Math.min(10, (attempt.unknownWords?.length ?? 0) * 2);

  return clampPercent(comprehension + 30 - supportPenalty - replayPenalty - unknownWordPenalty);
};

export class ProgressRepository {
  async recordEvent(input: ProgressEventInput) {
    if (!isDatabaseReady()) {
      return { created: true };
    }

    try {
      await ProgressEventModel.create({
        userId: input.userId,
        eventKey: input.eventKey,
        type: input.type,
        source: input.source,
        sourceId: input.sourceId,
        occurredAt: input.occurredAt ?? new Date(),
        payload: input.payload ?? {},
      });

      return { created: true };
    } catch (error: any) {
      if (error?.code === 11000) {
        return { created: false };
      }

      throw error;
    }
  }

  async findOrCreateDailyProgress(userId: string, level: EnglishLevel): Promise<ProgressSnapshot> {
    const defaults = {
      level,
      speakingScore: 0,
      listeningScore: 0,
      vocabularyScore: 0,
      pronunciationScore: 0,
      consistencyScore: 0,
      studiedMinutesToday: 0,
      streakDays: 0,
      completedBlocks: 0,
      completedPlans: 0,
    };

    if (!isDatabaseReady()) {
      return defaults;
    }

    const progress = await ProgressModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: defaults },
      { new: true, upsert: true }
    );

    return {
      level: progress.level as EnglishLevel,
      speakingScore: progress.speakingScore,
      listeningScore: progress.listeningScore,
      vocabularyScore: progress.vocabularyScore,
      pronunciationScore: progress.pronunciationScore,
      consistencyScore: progress.consistencyScore,
      studiedMinutesToday: progress.studiedMinutesToday,
      streakDays: progress.streakDays,
      completedBlocks: progress.completedBlocks ?? 0,
      completedPlans: progress.completedPlans ?? 0,
    };
  }

  async updateDailyProgress(userId: string, update: Partial<ProgressSnapshot>) {
    if (!isDatabaseReady()) {
      return update as ProgressSnapshot;
    }

    const saved = await ProgressModel.findOneAndUpdate(
      { userId },
      { $set: update },
      { new: true, upsert: true }
    );

    return {
      level: saved.level as EnglishLevel,
      speakingScore: saved.speakingScore,
      listeningScore: saved.listeningScore,
      vocabularyScore: saved.vocabularyScore,
      pronunciationScore: saved.pronunciationScore,
      consistencyScore: saved.consistencyScore,
      studiedMinutesToday: saved.studiedMinutesToday,
      streakDays: saved.streakDays,
      completedBlocks: saved.completedBlocks ?? 0,
      completedPlans: saved.completedPlans ?? 0,
    };
  }

  async incrementAccumulatedStats(userId: string, input: {
    minutes?: number;
    wordsPronounced?: number;
    phrasesPracticed?: number;
    speakingSessions?: number;
    recordings?: number;
    corrections?: number;
    transcribedText?: string;
    missedWords?: string[];
    mainImprovementArea?: string;
    occurredAt?: Date;
  }) {
    if (!isDatabaseReady()) {
      return createEmptyStats();
    }

    const occurredAt = input.occurredAt ?? new Date();
    const todayKey = dayKey(occurredAt);
    const existing = await UserProgressStatsModel.findOne({ userId });
    const lastStudyKey = existing?.lastStudyDate ? dayKey(existing.lastStudyDate) : undefined;
    const nextStreak =
      lastStudyKey === todayKey
        ? existing?.currentStreak ?? 1
        : lastStudyKey === previousDayKey(occurredAt)
          ? (existing?.currentStreak ?? 0) + 1
          : 1;

    const update: Record<string, unknown> = {
      $inc: {
        ...(input.wordsPronounced ? { totalWordsPronounced: input.wordsPronounced } : {}),
        ...(input.phrasesPracticed ? { totalPhrasesPracticed: input.phrasesPracticed } : {}),
        ...(input.speakingSessions ? { totalSpeakingSessions: input.speakingSessions } : {}),
        ...(input.recordings ? { totalRecordings: input.recordings } : {}),
        ...(input.corrections ? { totalCorrections: input.corrections } : {}),
        ...(input.minutes ? { totalStudyMinutes: input.minutes } : {}),
      },
      $set: {
        lastStudyDate: occurredAt,
        currentStreak: nextStreak,
        ...(input.mainImprovementArea ? { mainImprovementArea: input.mainImprovementArea } : {}),
      },
    };
    const addToSet = {
      ...(input.transcribedText
        ? { mostPracticedWords: { $each: extractWords(input.transcribedText).slice(0, 8) } }
        : {}),
      ...(input.missedWords?.length
        ? { mostMissedWords: { $each: input.missedWords.slice(0, 8).map((word) => word.toLowerCase()) } }
        : {}),
    };

    if (Object.keys(addToSet).length > 0) {
      update.$addToSet = addToSet;
    }

    const updated = await UserProgressStatsModel.findOneAndUpdate(
      { userId },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return mapStats(updated, await this.getWeeklySpeaking(userId));
  }

  async getProgressStats(userId: string): Promise<UserProgressStatsSnapshot> {
    if (!isDatabaseReady()) {
      return createEmptyStats();
    }

    const stats = await UserProgressStatsModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: createEmptyStats() },
      { new: true, upsert: true }
    );

    return mapStats(stats, await this.getWeeklySpeaking(userId));
  }

  async recalculateSkillScores(userId: string, level: EnglishLevel) {
    if (!isDatabaseReady()) {
      return this.findOrCreateDailyProgress(userId, level);
    }

    const [speakingAttempts, listeningAttempts, vocabularyItems] = await Promise.all([
      SpeakingAttemptModel.find({ userId }).sort({ createdAt: -1 }).limit(20),
      ListeningAttemptModel.find({ userId }).sort({ completedAt: -1 }).limit(20),
      VocabularyItemModel.find({ userId }).sort({ updatedAt: -1 }).limit(50),
    ]);

    const speakingScore = clampPercent(
      average(
        speakingAttempts.map((attempt) =>
          average([
            attempt.pronunciationScore,
            attempt.naturalnessScore,
            attempt.connectedSpeechScore,
            attempt.rhythmScore,
            attempt.fluencyScore,
          ]) * 10
        )
      )
    );
    const pronunciationScore = clampPercent(
      average(speakingAttempts.map((attempt) => attempt.pronunciationScore * 10))
    );
    const listeningScore = clampPercent(
      average(listeningAttempts.map(calculateListeningAttemptScore))
    );
    const vocabularyScore = clampPercent(
      average(
        vocabularyItems.map((item) => {
          const total = (item.timesCorrect ?? item.hits ?? 0) + (item.timesWrong ?? item.misses ?? 0);
          const accuracy = total > 0 ? ((item.timesCorrect ?? item.hits ?? 0) / total) * 100 : item.confidence;
          return average([item.confidence, accuracy]);
        })
      )
    );

    const current = await this.findOrCreateDailyProgress(userId, level);

    return this.updateDailyProgress(userId, {
      ...current,
      speakingScore,
      listeningScore,
      vocabularyScore,
      pronunciationScore,
    });
  }

  private async getWeeklySpeaking(userId: string) {
    if (!isDatabaseReady()) {
      return [];
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const attempts = await SpeakingAttemptModel.find({
      userId,
      createdAt: { $gte: sevenDaysAgo },
    }).sort({ createdAt: 1 });
    const byDay = new Map<string, number[]>();

    attempts.forEach((attempt) => {
      const key = attempt.createdAt.toISOString().slice(0, 10);
      const score = Math.round(
        (attempt.pronunciationScore +
          attempt.naturalnessScore +
          attempt.connectedSpeechScore +
          attempt.stressScore +
          attempt.intonationScore +
          attempt.rhythmScore +
          attempt.fluencyScore) /
          7
      );
      byDay.set(key, [...(byDay.get(key) ?? []), score]);
    });

    return Array.from(byDay.entries()).map(([dateLabel, scores]) => ({
      dateLabel,
      score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    }));
  }
}
