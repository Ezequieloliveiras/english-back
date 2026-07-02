import { Schema, model } from "mongoose";

const reviewScheduleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vocabularyItemId: { type: Schema.Types.ObjectId, ref: "VocabularyItem", required: true },
    hits: { type: Number, required: true, default: 0 },
    misses: { type: Number, required: true, default: 0 },
    confidence: { type: Number, required: true, default: 50 },
    nextReviewAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const ReviewScheduleModel = model("ReviewSchedule", reviewScheduleSchema);
