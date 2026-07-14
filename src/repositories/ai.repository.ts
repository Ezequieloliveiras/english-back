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
  sessionId?: string;
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
  correctionCount: number;
  feedback: unknown;
  suggestion?: string;
  durationSeconds?: number;
  speechRatio?: number;
  transcriptCoverage?: number;
  transcriptSimilarity?: number;
  analysisProvider?: string;
  analysisModel?: string;
  analysisDetails?: unknown;
  metricMetadata?: unknown;
  audioMimeType?: string;
  status?: string;
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

const trimMessages = (messages: MessageInput[], limit: number, maxCharacters: number) => {
  const recent = messages.slice(-limit);
  let total = 0;
  const trimmed: MessageInput[] = [];

  for (const message of [...recent].reverse()) {
    total += message.content.length;
    if (total > maxCharacters) {
      break;
    }
    trimmed.unshift(message);
  }

  return trimmed;
};

export class AiRepository {
  async saveConversationTurn(input: SaveConversationInput) {
    const messages: MessageInput[] = [
      { role: "user", content: input.userMessage, timestamp: new Date() },
      { role: "assistant", content: input.assistantMessage, timestamp: new Date() },
    ];

    if (!isDatabaseReady()) {
      const key = input.sessionId ?? `${input.userId}:${input.mode}`;
      memorySessions.set(key, [...(memorySessions.get(key) ?? []), ...messages]);
      return { sessionId: key };
    }

    const query = input.sessionId && mongoose.Types.ObjectId.isValid(input.sessionId)
      ? { _id: input.sessionId, userId: input.userId }
      : { userId: input.userId, mode: input.mode };
    const session = await ConversationSessionModel.findOneAndUpdate(
      query,
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

    return { sessionId: String(session._id) };
  }

  async getRecentConversationMessages(input: {
    userId: string;
    mode: string;
    sessionId?: string;
    limit?: number;
    maxCharacters?: number;
  }): Promise<MessageInput[]> {
    const limit = input.limit ?? 8;
    const maxCharacters = input.maxCharacters ?? 4000;

    if (!isDatabaseReady()) {
      const key = input.sessionId ?? `${input.userId}:${input.mode}`;
      return trimMessages(memorySessions.get(key) ?? [], limit, maxCharacters);
    }

    const query = input.sessionId && mongoose.Types.ObjectId.isValid(input.sessionId)
      ? { _id: input.sessionId, userId: input.userId }
      : { userId: input.userId, mode: input.mode };
    const session = await ConversationSessionModel.findOne(query).select("messages");

    return trimMessages((session?.messages ?? []) as MessageInput[], limit, maxCharacters);
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
      return input;
    }

    const attempt = await SpeakingAttemptModel.create(input);
    return attempt;
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
