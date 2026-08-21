import { Schema, model } from "mongoose";

// A compact record that says an item was offered in a daily plan.  It is kept
// separate from PracticeActivity because opening a plan is not a completion.
const contentExposureSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    fingerprint: { type: String, required: true },
    semanticFingerprint: { type: String },
    itemId: { type: String, required: true },
    title: { type: String, required: true },
    semantic: {
      topic: { type: String },
      subtopic: { type: String },
      scenario: { type: String },
      communicativeGoal: { type: String },
      setting: { type: String },
      participants: { type: [String], default: [] },
      keywords: { type: [String], default: [] },
    },
    firstPresentedAt: { type: Date, required: true },
    lastPresentedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

contentExposureSchema.index({ userId: 1, type: 1, fingerprint: 1 }, { unique: true });
contentExposureSchema.index({ userId: 1, lastPresentedAt: -1 });

export const ContentExposureModel = model("ContentExposure", contentExposureSchema);
