import { Schema, model } from "mongoose";

const studentMistakeSchema = new Schema(
  {
    userId: { type: String, required: true },
    originalSentence: { type: String, required: true },
    correctedSentence: { type: String, required: true },
    mistakeType: { type: String, required: true },
    explanation: { type: String, required: true },
    reviewDate: { type: Date, required: true },
    status: { type: String, required: true, default: "pending" },
  },
  { timestamps: true }
);

export const StudentMistakeModel = model("StudentMistake", studentMistakeSchema);
