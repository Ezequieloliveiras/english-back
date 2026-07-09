import { Schema, model } from "mongoose";

const sentenceSchema = new Schema(
  {
    text: { type: String, required: true },
    translation: { type: String },
  },
  { _id: false }
);

const vocabularyItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    phrase: { type: String, required: true },
    translation: { type: String },
    level: { type: String, required: true },
    category: { type: String, required: true },
    sentences: { type: [sentenceSchema], required: true },
    confidence: { type: Number, required: true },
    nextReviewAt: { type: Date, required: true },
    hits: { type: Number, required: true, default: 0 },
    misses: { type: Number, required: true, default: 0 },
    source: { type: String, required: true, default: "user_saved" },
    timesPracticed: { type: Number, required: true, default: 0 },
    timesCorrect: { type: Number, required: true, default: 0 },
    timesWrong: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const VocabularyItemModel = model("VocabularyItem", vocabularyItemSchema);
