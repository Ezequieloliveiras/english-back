"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioController = void 0;
const env_1 = require("../config/env");
const audio_service_1 = require("../services/audio.service");
class AudioController {
    constructor(audioService) {
        this.audioService = audioService;
        this.providers = (_request, response) => {
            response.json(this.audioService.listProviders());
        };
        this.speech = async (request, response) => {
            try {
                const audio = await this.audioService.createSpeech({ ...request.body, userId: request.auth?.userId });
                response.setHeader("Content-Type", audio.contentType);
                response.setHeader("Cache-Control", "no-store");
                response.setHeader("X-Audio-Cache", audio.cache);
                response.setHeader("X-Audio-Cacheable", String(audio.cacheable));
                if (audio.expiresAt) {
                    response.setHeader("X-Audio-Expires-At", audio.expiresAt.toISOString());
                }
                if (env_1.env.nodeEnv !== "production") {
                    response.setHeader("X-Audio-Cache-Key", audio.cacheKey);
                }
                response.send(audio.buffer);
            }
            catch (error) {
                const status = error instanceof audio_service_1.AudioProviderError ? error.statusCode : 400;
                response.status(status).json({
                    message: error instanceof Error ? error.message : "Could not generate audio",
                });
            }
        };
        this.alignedSpeech = async (request, response) => {
            try {
                const audio = await this.audioService.createAlignedSpeech({ ...request.body, userId: request.auth?.userId });
                response.setHeader("Cache-Control", "no-store");
                response.setHeader("X-Audio-Cache", audio.cache);
                response.setHeader("X-Audio-Cacheable", String(audio.cacheable));
                if (audio.expiresAt) {
                    response.setHeader("X-Audio-Expires-At", audio.expiresAt.toISOString());
                }
                if (env_1.env.nodeEnv !== "production") {
                    response.setHeader("X-Audio-Cache-Key", audio.cacheKey);
                }
                response.json({
                    audioBase64: audio.buffer.toString("base64"),
                    contentType: audio.contentType,
                    words: audio.words,
                    cache: audio.cache,
                    cacheable: audio.cacheable,
                    expiresAt: audio.expiresAt?.toISOString(),
                });
            }
            catch (error) {
                const status = error instanceof audio_service_1.AudioProviderError ? error.statusCode : 400;
                response.status(status).json({
                    message: error instanceof Error ? error.message : "Could not generate aligned audio",
                });
            }
        };
    }
}
exports.AudioController = AudioController;
