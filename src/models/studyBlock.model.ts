import { Schema, model } from "mongoose";

const studyBlockSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: "DailyPlan", required: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, required: true },
    progress: { type: Number, required: true },
    objective: { type: String, required: true },
  },
  { timestamps: true }
);

export const StudyBlockModel = model("StudyBlock", studyBlockSchema);
