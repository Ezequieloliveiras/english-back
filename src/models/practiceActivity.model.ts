import { Schema, model } from "mongoose";

const practiceActivitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    itemId: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, required: true, default: "completed" },
    completedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

practiceActivitySchema.index({ userId: 1, type: 1, itemId: 1 }, { unique: true });

export const PracticeActivityModel = model("PracticeActivity", practiceActivitySchema);
