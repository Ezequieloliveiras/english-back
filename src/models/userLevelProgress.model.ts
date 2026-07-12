import { Schema, model } from "mongoose";

const userLevelProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    currentLevel: { type: String, required: true },
    targetLevel: { type: String, required: true },
    levelProgress: { type: Number, required: true, default: 0 },
    competenciesMastered: { type: Number, required: true, default: 0 },
    competenciesRequired: { type: Number, required: true, default: 0 },
    checkpointStatus: {
      type: String,
      required: true,
      default: "locked",
      enum: ["locked", "available", "in_progress", "passed", "failed"],
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userLevelProgressSchema.index({ userId: 1 }, { unique: true });

export const UserLevelProgressModel = model("UserLevelProgress", userLevelProgressSchema);
