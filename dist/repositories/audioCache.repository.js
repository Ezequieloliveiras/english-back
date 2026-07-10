"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioCacheRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const audioCache_model_1 = require("../models/audioCache.model");
const isDatabaseReady = () => mongoose_1.default.connection.readyState === 1;
const mapRecord = (record) => ({
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
class AudioCacheRepository {
    async findValidByKey(key) {
        if (!isDatabaseReady()) {
            return null;
        }
        const record = await audioCache_model_1.AudioCacheModel.findOneAndUpdate({ key, expiresAt: { $gt: new Date() } }, {
            $inc: { hitCount: 1 },
            $set: { lastAccessedAt: new Date() },
        }, { new: true });
        return record ? mapRecord(record) : null;
    }
    async save(input) {
        if (!isDatabaseReady()) {
            return null;
        }
        const record = await audioCache_model_1.AudioCacheModel.findOneAndUpdate({ key: input.key }, {
            $set: {
                ...input,
                lastAccessedAt: new Date(),
            },
            $setOnInsert: {
                hitCount: 0,
            },
        }, { new: true, upsert: true });
        return mapRecord(record);
    }
    async deleteExpired() {
        if (!isDatabaseReady()) {
            return 0;
        }
        const result = await audioCache_model_1.AudioCacheModel.deleteMany({ expiresAt: { $lte: new Date() } });
        return result.deletedCount ?? 0;
    }
}
exports.AudioCacheRepository = AudioCacheRepository;
