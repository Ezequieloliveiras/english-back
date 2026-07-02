import { Schema, model } from "mongoose";

const messageSchema = new Schema(
  {
    role: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const conversationSessionSchema = new Schema(
  {
    userId: { type: String, required: true },
    mode: { type: String, required: true },
    modeId: { type: String },
    title: { type: String },
    messages: { type: [messageSchema], required: true },
    corrections: { type: [String], default: [] },
    suggestedPhrases: { type: [String], default: [] },
    mistakes: { type: [Schema.Types.ObjectId], ref: "StudentMistake", default: [] },
  },
  { timestamps: true }
);

export const ConversationSessionModel = model("ConversationSession", conversationSessionSchema);
