import { Schema, model } from "mongoose";

const userGoalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true },
    targetLevel: { type: String, required: true },
    progress: { type: Number, required: true },
  },
  { timestamps: true }
);

export const UserGoalModel = model("UserGoal", userGoalSchema);
