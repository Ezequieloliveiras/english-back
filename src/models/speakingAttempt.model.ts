import { Schema, model } from "mongoose";

const speakingAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    phraseId: { type: String },
    expectedText: { type: String, required: true },
    transcribedText: { type: String, required: true },
    audioUrl: { type: String },
    pronunciationScore: { type: Number, required: true, default: 0 },
    naturalnessScore: { type: Number, required: true, default: 0 },
    connectedSpeechScore: { type: Number, required: true, default: 0 },
    stressScore: { type: Number, required: true, default: 0 },
    intonationScore: { type: Number, required: true, default: 0 },
    rhythmScore: { type: Number, required: true, default: 0 },
    fluencyScore: { type: Number, required: true, default: 0 },
    wordsSpokenCount: { type: Number, required: true, default: 0 },
    correctedWords: { type: [String], required: true, default: [] },
    feedback: { type: Schema.Types.Mixed, required: true, default: {} },
    suggestion: { type: String },
  },
  { timestamps: true }
);

speakingAttemptSchema.index({ userId: 1, createdAt: -1 });

export const SpeakingAttemptModel = model("SpeakingAttempt", speakingAttemptSchema);
