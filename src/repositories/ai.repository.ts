import mongoose from "mongoose";
import { ConversationSessionModel } from "../models/conversationSession.model";
import { StudentMistakeModel } from "../models/studentMistake.model";

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

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const memorySessions = new Map<string, MessageInput[]>();
const memoryMistakes: SaveMistakeInput[] = [];

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
}
