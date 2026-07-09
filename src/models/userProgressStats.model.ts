import { Schema, model } from "mongoose";

const userProgressStatsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    totalWordsPronounced: { type: Number, required: true, default: 0 },
    totalPhrasesPracticed: { type: Number, required: true, default: 0 },
    totalSpeakingSessions: { type: Number, required: true, default: 0 },
    totalStudyMinutes: { type: Number, required: true, default: 0 },
    totalRecordings: { type: Number, required: true, default: 0 },
    totalCorrections: { type: Number, required: true, default: 0 },
    currentStreak: { type: Number, required: true, default: 0 },
    lastStudyDate: { type: Date },
    mainImprovementArea: { type: String, required: true, default: "Not enough data yet" },
    mostPracticedWords: { type: [String], required: true, default: [] },
    mostMissedWords: { type: [String], required: true, default: [] },
  },
  { timestamps: true }
);

export const UserProgressStatsModel = model("UserProgressStats", userProgressStatsSchema);
