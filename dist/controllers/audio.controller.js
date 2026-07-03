"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioController = void 0;
const audio_service_1 = require("../services/audio.service");
class AudioController {
    constructor(audioService) {
        this.audioService = audioService;
        this.providers = (_request, response) => {
            response.json(this.audioService.listProviders());
        };
        this.speech = async (request, response) => {
            try {
                const audio = await this.audioService.createSpeech(request.body);
                response.setHeader("Content-Type", audio.contentType);
                response.setHeader("Cache-Control", "no-store");
                response.send(audio.buffer);
            }
            catch (error) {
                const status = error instanceof audio_service_1.AudioProviderError ? error.statusCode : 400;
                response.status(status).json({
                    message: error instanceof Error ? error.message : "Could not generate audio",
                });
            }
        };
    }
}
exports.AudioController = AudioController;
