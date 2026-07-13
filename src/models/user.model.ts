import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String },
    currentLevel: { type: String, required: true },
    dailyMinutes: { type: Number, required: true },
    profession: { type: String, required: true },
    primaryGoal: { type: String, required: true },
    mainDifficulty: { type: String, required: true },
    initialSetupCompleted: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export const UserModel = model("User", userSchema);
