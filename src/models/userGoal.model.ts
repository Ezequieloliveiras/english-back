import { Schema, model } from "mongoose";

const userGoalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    primaryGoal: { type: String, required: true },
    targetLevel: { type: String, required: true },
    professionalContext: { type: String, default: "" },
    deadline: { type: Date },
  },
  { timestamps: true }
);

userGoalSchema.index({ userId: 1 }, { unique: true });

export const UserGoalModel = model("UserGoal", userGoalSchema);
