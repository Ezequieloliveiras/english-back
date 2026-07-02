import { Schema, model } from "mongoose";

const progressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    level: { type: String, required: true },
    speakingScore: { type: Number, required: true },
    listeningScore: { type: Number, required: true },
    vocabularyScore: { type: Number, required: true },
    pronunciationScore: { type: Number, required: true },
    consistencyScore: { type: Number, required: true },
    studiedMinutesToday: { type: Number, required: true },
    streakDays: { type: Number, required: true },
  },
  { timestamps: true }
);

export const ProgressModel = model("Progress", progressSchema);
