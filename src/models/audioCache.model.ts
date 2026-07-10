import { Schema, model } from "mongoose";

const audioCacheSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    textHash: { type: String, required: true },
    textNormalized: { type: String, required: true },
    voice: { type: String, required: true },
    speed: { type: Number, required: true },
    accent: { type: String, required: true },
    language: { type: String, required: true },
    audioType: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storageType: {
      type: String,
      required: true,
      default: "mongo",
      enum: ["mongo", "local", "s3"],
    },
    audioData: { type: Buffer },
    filePath: { type: String },
    publicUrl: { type: String },
    expiresAt: { type: Date, required: true },
    hitCount: { type: Number, required: true, default: 0 },
    lastAccessedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

audioCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
audioCacheSchema.index({ textHash: 1 });
audioCacheSchema.index({ audioType: 1 });
audioCacheSchema.index({ lastAccessedAt: -1 });

export const AudioCacheModel = model("AudioCache", audioCacheSchema);
