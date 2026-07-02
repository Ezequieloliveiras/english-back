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
    phrase: { type: String, required: true },
    translation: { type: String },
    level: { type: String, required: true },
    category: { type: String, required: true },
    sentences: { type: [sentenceSchema], required: true },
    confidence: { type: Number, required: true },
    nextReviewAt: { type: Date, required: true },
    hits: { type: Number, required: true, default: 0 },
    misses: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const VocabularyItemModel = model("VocabularyItem", vocabularyItemSchema);
