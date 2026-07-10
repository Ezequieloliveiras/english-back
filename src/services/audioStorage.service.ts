import { AudioCacheRecord, AudioCacheRecordInput } from "../repositories/audioCache.repository";

export interface StoredAudio {
  storageType: "mongo" | "local" | "s3";
  audioData?: Buffer;
  filePath?: string;
  publicUrl?: string;
  sizeBytes: number;
}

export class AudioStorageService {
  async storeInMongo(buffer: Buffer): Promise<StoredAudio> {
    return {
      storageType: "mongo",
      audioData: buffer,
      sizeBytes: buffer.byteLength,
    };
  }

  async read(record: AudioCacheRecord | AudioCacheRecordInput) {
    if (record.storageType === "mongo" && record.audioData) {
      return record.audioData;
    }

    return null;
  }
}
