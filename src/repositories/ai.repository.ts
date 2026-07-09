import mongoose from "mongoose";
import { ConversationSessionModel } from "../models/conversationSession.model";
import { SpeakingAttemptModel } from "../models/speakingAttempt.model";
import { StudentMistakeModel } from "../models/studentMistake.model";
import { UserProgressStatsModel } from "../models/userProgressStats.model";

interface MessageInput {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

interface SaveConversationInput {
  userId: string;
  mode: string;
  userMessage: string;
  assistantMessage: string;
  correction?: string;
  suggestedPhrase?: string;
}

interface SaveMistakeInput {
  userId: string;
  originalSentence: string;
  correctedSentence: string;
  mistakeType: string;
  explanation: string;
}

interface SaveSpeakingAttemptInput {
  userId: string;
  phraseId?: string;
  expectedText: string;
  transcribedText: string;
  audioUrl?: string;
  pronunciationScore: number;
  naturalnessScore: number;
  connectedSpeechScore: number;
  stressScore: number;
  intonationScore: number;
  rhythmScore: number;
  fluencyScore: number;
  wordsSpokenCount: number;
  correctedWords: string[];
  feedback: unknown;
  suggestion?: string;
}

export interface UserProgressStats {
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
  weeklySpeaking: Array<{
    dateLabel: string;
    score: number;
  }>;
}

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const memorySessions = new Map<string, MessageInput[]>();
const memoryMistakes: SaveMistakeInput[] = [];
const memorySpeakingAttempts = new Map<string, SaveSpeakingAttemptInput[]>();
const memoryStats = new Map<string, UserProgressStats>();

const nextReviewDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date;
};

export class AiRepository {
  async saveConversationTurn(input: SaveConversationInput) {
    const messages: MessageInput[] = [
      { role: "user", content: input.userMessage, timestamp: new Date() },
      { role: "assistant", content: input.assistantMessage, timestamp: new Date() },
    ];

    if (!isDatabaseReady()) {
      const key = `${input.userId}:${input.mode}`;
      memorySessions.set(key, [...(memorySessions.get(key) ?? []), ...messages]);
      return;
    }

    await ConversationSessionModel.findOneAndUpdate(
      { userId: input.userId, mode: input.mode },
      {
        $setOnInsert: {
          userId: input.userId,
          mode: input.mode,
          modeId: input.mode,
          title: input.mode,
        },
        $push: {
          messages: { $each: messages },
          ...(input.correction ? { corrections: input.correction } : {}),
          ...(input.suggestedPhrase ? { suggestedPhrases: input.suggestedPhrase } : {}),
        },
      },
      { new: true, upsert: true }
    );
  }

  async saveMistake(input: SaveMistakeInput) {
    if (!input.originalSentence || !input.correctedSentence) {
      return null;
    }

    if (!isDatabaseReady()) {
      memoryMistakes.push(input);
      return null;
    }

    const mistake = await StudentMistakeModel.create({
      ...input,
      reviewDate: nextReviewDate(),
      status: "pending",
    });

    await ConversationSessionModel.updateMany(
      { userId: input.userId },
      { $addToSet: { mistakes: mistake._id } }
    );

    return mistake;
  }

  async saveSpeakingAttempt(input: SaveSpeakingAttemptInput) {
    if (!isDatabaseReady()) {
      const attempts = memorySpeakingAttempts.get(input.userId) ?? [];
      memorySpeakingAttempts.set(input.userId, [...attempts, input]);
      await this.incrementSpeakingStats(input);
      return input;
    }

    const attempt = await SpeakingAttemptModel.create(input);
    await this.incrementSpeakingStats(input);
    return attempt;
  }

  async incrementSpeakingStats(input: SaveSpeakingAttemptInput) {
    const correctionCount = input.correctedWords.length || input.feedback ? 1 : 0;
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    if (!isDatabaseReady()) {
      const existing = memoryStats.get(input.userId) ?? createEmptyStats();
      const lastStudyKey = existing.lastStudyDate?.slice(0, 10);
      const currentStreak =
        lastStudyKey === todayKey ? existing.currentStreak : existing.currentStreak + 1;

      const updated = {
        ...existing,
        totalWordsPronounced: existing.totalWordsPronounced + input.wordsSpokenCount,
        totalPhrasesPracticed: existing.totalPhrasesPracticed + 1,
        totalSpeakingSessions: existing.totalSpeakingSessions + 1,
        totalRecordings: existing.totalRecordings + 1,
        totalCorrections: existing.totalCorrections + correctionCount,
        currentStreak,
        lastStudyDate: today.toISOString(),
        mainImprovementArea: findLowestScoreArea(input),
        mostPracticedWords: mergeWords(existing.mostPracticedWords, input.transcribedText),
        mostMissedWords: mergeList(existing.mostMissedWords, input.correctedWords),
        weeklySpeaking: buildMemoryWeeklySpeaking(input.userId, input),
      };
      memoryStats.set(input.userId, updated);
      return updated;
    }

    const existing = await UserProgressStatsModel.findOne({ userId: input.userId });
    const lastStudyKey = existing?.lastStudyDate?.toISOString().slice(0, 10);
    const shouldIncrementStreak = lastStudyKey !== todayKey;

    const updated = await UserProgressStatsModel.findOneAndUpdate(
      { userId: input.userId },
      {
        $inc: {
          totalWordsPronounced: input.wordsSpokenCount,
          totalPhrasesPracticed: 1,
          totalSpeakingSessions: 1,
          totalRecordings: 1,
          totalCorrections: correctionCount,
          ...(shouldIncrementStreak ? { currentStreak: 1 } : {}),
        },
        $set: {
          lastStudyDate: today,
          mainImprovementArea: findLowestScoreArea(input),
        },
        $addToSet: {
          mostPracticedWords: { $each: extractWords(input.transcribedText).slice(0, 8) },
          mostMissedWords: { $each: input.correctedWords.slice(0, 8) },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return mapStats(updated, await this.getWeeklySpeaking(input.userId));
  }

  async getProgressStats(userId: string): Promise<UserProgressStats> {
    if (!isDatabaseReady()) {
      return memoryStats.get(userId) ?? createEmptyStats();
    }

    const stats = await UserProgressStatsModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: createEmptyStats() },
      { new: true, upsert: true }
    );

    return mapStats(stats, await this.getWeeklySpeaking(userId));
  }

  async getRecentSpeakingAttempts(userId: string) {
    if (!isDatabaseReady()) {
      return (memorySpeakingAttempts.get(userId) ?? []).slice(-8).reverse();
    }

    const attempts = await SpeakingAttemptModel.find({ userId }).sort({ createdAt: -1 }).limit(8);

    return attempts.map((attempt) => ({
      id: String(attempt._id),
      expectedText: attempt.expectedText,
      transcribedText: attempt.transcribedText,
      pronunciationScore: attempt.pronunciationScore,
      naturalnessScore: attempt.naturalnessScore,
      connectedSpeechScore: attempt.connectedSpeechScore,
      wordsSpokenCount: attempt.wordsSpokenCount,
      correctedWords: attempt.correctedWords,
      suggestion: attempt.suggestion,
      createdAt: attempt.createdAt?.toISOString?.(),
    }));
  }

  private async getWeeklySpeaking(userId: string) {
    if (!isDatabaseReady()) {
      return memoryStats.get(userId)?.weeklySpeaking ?? [];
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

const createEmptyStats = (): UserProgressStats => ({
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

const mapStats = (stats: any, weeklySpeaking: UserProgressStats["weeklySpeaking"]): UserProgressStats => ({
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

const mergeWords = (current: string[], text: string) => mergeList(current, extractWords(text));

const mergeList = (current: string[], incoming: string[]) =>
  Array.from(new Set([...current, ...incoming.map((item) => item.toLowerCase())])).slice(0, 20);

const findLowestScoreArea = (input: SaveSpeakingAttemptInput) => {
  const scores = [
    ["Pronunciation", input.pronunciationScore],
    ["Naturalness", input.naturalnessScore],
    ["Connected Speech", input.connectedSpeechScore],
    ["Stress", input.stressScore],
    ["Intonation", input.intonationScore],
    ["Rhythm", input.rhythmScore],
    ["Fluency", input.fluencyScore],
  ] as const;

  return [...scores].sort((a, b) => a[1] - b[1])[0][0];
};

const buildMemoryWeeklySpeaking = (userId: string, input: SaveSpeakingAttemptInput) => {
  const attempts = (memorySpeakingAttempts.get(userId) ?? [input]).slice(-7);

  return attempts.map((attempt, index) => ({
    dateLabel: index === attempts.length - 1 ? "Today" : `Attempt ${index + 1}`,
    score: Math.round(
      (attempt.pronunciationScore +
        attempt.naturalnessScore +
        attempt.connectedSpeechScore +
        attempt.stressScore +
        attempt.intonationScore +
        attempt.rhythmScore +
        attempt.fluencyScore) /
        7
    ),
  }));
};
