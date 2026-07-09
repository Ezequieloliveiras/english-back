import { Schema, model } from "mongoose";

const reviewItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vocabularyItemId: { type: Schema.Types.ObjectId, ref: "VocabularyItem", required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      default: "due",
      enum: ["due", "scheduled", "completed"],
    },
    reviewCount: { type: Number, required: true, default: 0 },
    lastResult: {
      type: String,
      enum: ["correct", "wrong", "skipped", null],
      default: null,
    },
  },
  { timestamps: true }
);

reviewItemSchema.index({ userId: 1, vocabularyItemId: 1 }, { unique: true });

export const ReviewItemModel = model("ReviewItem", reviewItemSchema);
