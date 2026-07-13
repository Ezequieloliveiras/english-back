import { Schema, model } from "mongoose";

const listeningAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    exerciseId: { type: String, required: true },
    expectedText: { type: String, required: true },
    selectedMeaning: { type: String },
    comprehensionCorrect: { type: Boolean, required: true, default: false },
    translationOpened: { type: Boolean, required: true, default: false },
    transcriptOpened: { type: Boolean, required: true, default: false },
    slowAudioUsed: { type: Boolean, required: true, default: false },
    replayCount: { type: Number, required: true, default: 0 },
    unknownWords: { type: [String], required: true, default: [] },
    completedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

listeningAttemptSchema.index({ userId: 1, exerciseId: 1 }, { unique: true });

export const ListeningAttemptModel = model("ListeningAttempt", listeningAttemptSchema);
