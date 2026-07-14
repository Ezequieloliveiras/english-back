"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const conversationSession_model_1 = require("../models/conversationSession.model");
const speakingAttempt_model_1 = require("../models/speakingAttempt.model");
const studentMistake_model_1 = require("../models/studentMistake.model");
const userProgressStats_model_1 = require("../models/userProgressStats.model");
const isDatabaseReady = () => mongoose_1.default.connection.readyState === 1;
const memorySessions = new Map();
const memoryMistakes = [];
const memorySpeakingAttempts = new Map();
const memoryStats = new Map();
const nextReviewDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date;
};
const trimMessages = (messages, limit, maxCharacters) => {
    const recent = messages.slice(-limit);
    let total = 0;
    const trimmed = [];
    for (const message of [...recent].reverse()) {
        total += message.content.length;
        if (total > maxCharacters) {
            break;
        }
        trimmed.unshift(message);
    }
    return trimmed;
};
class AiRepository {
    async saveConversationTurn(input) {
        const messages = [
            { role: "user", content: input.userMessage, timestamp: new Date() },
            { role: "assistant", content: input.assistantMessage, timestamp: new Date() },
        ];
        if (!isDatabaseReady()) {
            const key = input.sessionId ?? `${input.userId}:${input.mode}`;
            memorySessions.set(key, [...(memorySessions.get(key) ?? []), ...messages]);
            return { sessionId: key };
        }
        const query = input.sessionId && mongoose_1.default.Types.ObjectId.isValid(input.sessionId)
            ? { _id: input.sessionId, userId: input.userId }
            : { userId: input.userId, mode: input.mode };
        const session = await conversationSession_model_1.ConversationSessionModel.findOneAndUpdate(query, {
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
        }, { new: true, upsert: true });
        return { sessionId: String(session._id) };
    }
    async getRecentConversationMessages(input) {
        const limit = input.limit ?? 8;
        const maxCharacters = input.maxCharacters ?? 4000;
        if (!isDatabaseReady()) {
            const key = input.sessionId ?? `${input.userId}:${input.mode}`;
            return trimMessages(memorySessions.get(key) ?? [], limit, maxCharacters);
        }
        const query = input.sessionId && mongoose_1.default.Types.ObjectId.isValid(input.sessionId)
            ? { _id: input.sessionId, userId: input.userId }
            : { userId: input.userId, mode: input.mode };
        const session = await conversationSession_model_1.ConversationSessionModel.findOne(query).select("messages");
        return trimMessages((session?.messages ?? []), limit, maxCharacters);
    }
    async saveMistake(input) {
        if (!input.originalSentence || !input.correctedSentence) {
            return null;
        }
        if (!isDatabaseReady()) {
            memoryMistakes.push(input);
            return null;
        }
        const mistake = await studentMistake_model_1.StudentMistakeModel.create({
            ...input,
            reviewDate: nextReviewDate(),
            status: "pending",
        });
        await conversationSession_model_1.ConversationSessionModel.updateMany({ userId: input.userId }, { $addToSet: { mistakes: mistake._id } });
        return mistake;
    }
    async saveSpeakingAttempt(input) {
        if (!isDatabaseReady()) {
            const attempts = memorySpeakingAttempts.get(input.userId) ?? [];
            memorySpeakingAttempts.set(input.userId, [...attempts, input]);
            return input;
        }
        const attempt = await speakingAttempt_model_1.SpeakingAttemptModel.create(input);
        return attempt;
    }
    async getProgressStats(userId) {
        if (!isDatabaseReady()) {
            return memoryStats.get(userId) ?? createEmptyStats();
        }
        const stats = await userProgressStats_model_1.UserProgressStatsModel.findOneAndUpdate({ userId }, { $setOnInsert: createEmptyStats() }, { new: true, upsert: true });
        return mapStats(stats, await this.getWeeklySpeaking(userId));
    }
    async getRecentSpeakingAttempts(userId) {
        if (!isDatabaseReady()) {
            return (memorySpeakingAttempts.get(userId) ?? []).slice(-8).reverse();
        }
        const attempts = await speakingAttempt_model_1.SpeakingAttemptModel.find({ userId }).sort({ createdAt: -1 }).limit(8);
        return attempts.map((attempt) => ({
            id: String(attempt._id),
            expectedText: attempt.expectedText,
            transcribedText: attempt.transcribedText,
            rawTranscript: attempt.rawTranscript ?? attempt.transcribedText,
            normalizedTranscript: attempt.normalizedTranscript ?? attempt.transcribedText,
            correctedText: attempt.correctedText,
            translated: attempt.translated ?? false,
            detectedLanguage: attempt.detectedLanguage,
            targetLanguage: attempt.targetLanguage,
            transcriptionLanguage: attempt.transcriptionLanguage,
            feedbackPtBr: attempt.feedbackPtBr,
            wordAnalysis: attempt.wordAnalysis ?? [],
            preferencesVersion: attempt.preferencesVersion,
            pronunciationScore: attempt.pronunciationScore,
            naturalnessScore: attempt.naturalnessScore,
            connectedSpeechScore: attempt.connectedSpeechScore,
            wordsSpokenCount: attempt.wordsSpokenCount,
            correctedWords: attempt.correctedWords,
            suggestion: attempt.suggestion,
            createdAt: attempt.createdAt?.toISOString?.(),
        }));
    }
    async getWeeklySpeaking(userId) {
        if (!isDatabaseReady()) {
            return memoryStats.get(userId)?.weeklySpeaking ?? [];
        }
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const attempts = await speakingAttempt_model_1.SpeakingAttemptModel.find({
            userId,
            createdAt: { $gte: sevenDaysAgo },
        }).sort({ createdAt: 1 });
        const byDay = new Map();
        attempts.forEach((attempt) => {
            const key = attempt.createdAt.toISOString().slice(0, 10);
            const score = Math.round((attempt.pronunciationScore +
                attempt.naturalnessScore +
                attempt.connectedSpeechScore +
                attempt.stressScore +
                attempt.intonationScore +
                attempt.rhythmScore +
                attempt.fluencyScore) /
                7);
            byDay.set(key, [...(byDay.get(key) ?? []), score]);
        });
        return Array.from(byDay.entries()).map(([dateLabel, scores]) => ({
            dateLabel,
            score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
        }));
    }
}
exports.AiRepository = AiRepository;
const createEmptyStats = () => ({
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
const mapStats = (stats, weeklySpeaking) => ({
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
