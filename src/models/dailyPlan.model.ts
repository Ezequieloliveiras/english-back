import { Schema, model } from "mongoose";

const studyBlockSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, required: true },
    progress: { type: Number, required: true },
    objective: { type: String, required: true },
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
    blocks: { type: [studyBlockSchema], required: true },
  },
  { timestamps: true }
);

export const DailyPlanModel = model("DailyPlan", dailyPlanSchema);
