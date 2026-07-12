import { Schema, model } from "mongoose";

const competencyEvidenceSchema = new Schema(
  {
    type: { type: String, required: true },
    score: { type: Number, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
    sourceId: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const competencyProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    competencyId: { type: String, required: true },
    masteryScore: { type: Number, required: true, default: 0 },
    retentionScore: { type: Number, required: true, default: 0 },
    confidenceScore: { type: Number, required: true, default: 0 },
    attempts: { type: Number, required: true, default: 0 },
    successfulAttempts: { type: Number, required: true, default: 0 },
    lastPracticedAt: { type: Date, default: null },
    lastAssessedAt: { type: Date, default: null },
    masteredAt: { type: Date, default: null },
    status: {
      type: String,
      required: true,
      default: "learning",
      enum: ["locked", "learning", "reviewing", "mastered"],
    },
    evidence: { type: [competencyEvidenceSchema], required: true, default: [] },
  },
  { timestamps: true }
);

competencyProgressSchema.index({ userId: 1, competencyId: 1 }, { unique: true });

export const CompetencyProgressModel = model("CompetencyProgress", competencyProgressSchema);
