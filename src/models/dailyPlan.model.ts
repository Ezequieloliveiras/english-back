import { Schema, model } from "mongoose";

const dailyPlanStepSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    status: { type: String, required: true, default: "not_started" },
    required: { type: Boolean, required: true, default: true },
    completedAt: { type: String, default: null },
    evidenceType: { type: String },
    evidenceRef: { type: String },
  },
  { _id: false }
);

const studyBlockSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, required: true },
    progress: { type: Number, required: true },
    objective: { type: String, required: true },
    requiredSteps: { type: [dailyPlanStepSchema], required: true, default: [] },
    completedSteps: { type: Number, required: true, default: 0 },
    totalSteps: { type: Number, required: true, default: 0 },
    progressPercentage: { type: Number, required: true, default: 0 },
    startedAt: { type: String, default: null },
    completedAt: { type: String, default: null },
  },
  { _id: false }
);

const dailyPlanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    focus: { type: String, required: true },
    totalMinutes: { type: Number, required: true },
    streak: { type: Number, required: true },
    date: { type: String, required: true },
    status: { type: String, required: true, default: "not_started" },
    completedAt: { type: String, default: null },
    generationMethod: {
      type: String,
      required: true,
      default: "heuristic",
      enum: ["heuristic", "ai", "hybrid"],
    },
    generationReason: { type: String, required: true, default: "Generated from profile level, goal, difficulty, profession and available minutes." },
    blocks: { type: [studyBlockSchema], required: true },
  },
  { timestamps: true }
);

export const DailyPlanModel = model("DailyPlan", dailyPlanSchema);
