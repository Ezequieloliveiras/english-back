import mongoose from "mongoose";
import { AudioCacheModel } from "../models/audioCache.model";

export interface AudioCacheRecordInput {
  key: string;
  provider: string;
  model: string;
  textHash: string;
  textNormalized: string;
  voice: string;
  speed: number;
  accent: string;
  language: string;
  audioType: string;
  mimeType: string;
  sizeBytes: number;
  storageType: "mongo" | "local" | "s3";
  audioData?: Buffer;
  filePath?: string;
  publicUrl?: string;
  expiresAt: Date;
}

export interface AudioCacheRecord extends AudioCacheRecordInput {
  hitCount: number;
  lastAccessedAt: Date;
}

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const mapRecord = (record: any): AudioCacheRecord => ({
  key: record.key,
  provider: record.provider,
  model: record.model,
  textHash: record.textHash,
  textNormalized: record.textNormalized,
  voice: record.voice,
  speed: record.speed,
  accent: record.accent,
  language: record.language,
  audioType: record.audioType,
  mimeType: record.mimeType,
  sizeBytes: record.sizeBytes,
  storageType: record.storageType,
  audioData: record.audioData,
  filePath: record.filePath,
  publicUrl: record.publicUrl,
  expiresAt: record.expiresAt,
  hitCount: record.hitCount,
  lastAccessedAt: record.lastAccessedAt,
});

export class AudioCacheRepository {
  async findValidByKey(key: string) {
    if (!isDatabaseReady()) {
      return null;
    }

    const record = await AudioCacheModel.findOneAndUpdate(
      { key, expiresAt: { $gt: new Date() } },
      {
        $inc: { hitCount: 1 },
        $set: { lastAccessedAt: new Date() },
      },
      { new: true }
    );

    return record ? mapRecord(record) : null;
  }

  async save(input: AudioCacheRecordInput) {
    if (!isDatabaseReady()) {
      return null;
    }

    const record = await AudioCacheModel.findOneAndUpdate(
      { key: input.key },
      {
        $set: {
          ...input,
          lastAccessedAt: new Date(),
        },
        $setOnInsert: {
          hitCount: 0,
        },
      },
      { new: true, upsert: true }
    );

    return mapRecord(record);
  }

  async deleteExpired() {
    if (!isDatabaseReady()) {
      return 0;
    }

    const result = await AudioCacheModel.deleteMany({ expiresAt: { $lte: new Date() } });
    return result.deletedCount ?? 0;
  }
}
