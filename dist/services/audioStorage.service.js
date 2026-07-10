"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStorageService = void 0;
class AudioStorageService {
    async storeInMongo(buffer) {
        return {
            storageType: "mongo",
            audioData: buffer,
            sizeBytes: buffer.byteLength,
        };
    }
    async read(record) {
        if (record.storageType === "mongo" && record.audioData) {
            return record.audioData;
        }
        return null;
    }
}
exports.AudioStorageService = AudioStorageService;
