import { Schema, model } from "mongoose";

const diagnosticEvidenceSchema = new Schema(
  {
    type: { type: String, required: true },
    score: { type: Number, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const diagnosticAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    declaredLevel: { type: String },
    diagnosedLevel: { type: String },
    selectedLevel: { type: String },
    confidence: { type: Number, required: true, default: 0 },
    evidence: { type: [diagnosticEvidenceSchema], required: true, default: [] },
    status: {
      type: String,
      required: true,
      default: "in_progress",
      enum: ["in_progress", "completed"],
    },
  },
  { timestamps: true }
);

diagnosticAttemptSchema.index({ userId: 1, createdAt: -1 });

export const DiagnosticAttemptModel = model("DiagnosticAttempt", diagnosticAttemptSchema);
