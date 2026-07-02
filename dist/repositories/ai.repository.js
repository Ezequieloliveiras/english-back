"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const conversationSession_model_1 = require("../models/conversationSession.model");
const studentMistake_model_1 = require("../models/studentMistake.model");
const isDatabaseReady = () => mongoose_1.default.connection.readyState === 1;
const memorySessions = new Map();
const memoryMistakes = [];
const nextReviewDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date;
};
class AiRepository {
    async saveConversationTurn(input) {
        const messages = [
            { role: "user", content: input.userMessage, timestamp: new Date() },
            { role: "assistant", content: input.assistantMessage, timestamp: new Date() },
        ];
        if (!isDatabaseReady()) {
            const key = `${input.userId}:${input.mode}`;
            memorySessions.set(key, [...(memorySessions.get(key) ?? []), ...messages]);
            return;
        }
        await conversationSession_model_1.ConversationSessionModel.findOneAndUpdate({ userId: input.userId, mode: input.mode }, {
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
}
exports.AiRepository = AiRepository;
