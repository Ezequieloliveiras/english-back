import { Response } from "express";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AudioProviderError, AudioService } from "../services/audio.service";

export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  providers = (_request: AuthenticatedRequest, response: Response) => {
    response.json(this.audioService.listProviders());
  };

  speech = async (request: AuthenticatedRequest, response: Response) => {
    try {
      const audio = await this.audioService.createSpeech(request.body);
      response.setHeader("Content-Type", audio.contentType);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Audio-Cache", audio.cache);
      response.setHeader("X-Audio-Cacheable", String(audio.cacheable));
      if (audio.expiresAt) {
        response.setHeader("X-Audio-Expires-At", audio.expiresAt.toISOString());
      }
      if (env.nodeEnv !== "production") {
        response.setHeader("X-Audio-Cache-Key", audio.cacheKey);
      }
      response.send(audio.buffer);
    } catch (error) {
      const status = error instanceof AudioProviderError ? error.statusCode : 400;

      response.status(status).json({
        message: error instanceof Error ? error.message : "Could not generate audio",
      });
    }
  };

  alignedSpeech = async (request: AuthenticatedRequest, response: Response) => {
    try {
      const audio = await this.audioService.createAlignedSpeech(request.body);
      response.setHeader("Content-Type", audio.contentType);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Audio-Cache", audio.cache);
      response.setHeader("X-Audio-Cacheable", String(audio.cacheable));
      response.setHeader("X-Audio-Words", Buffer.from(JSON.stringify(audio.words)).toString("base64url"));
      if (audio.expiresAt) {
        response.setHeader("X-Audio-Expires-At", audio.expiresAt.toISOString());
      }
      if (env.nodeEnv !== "production") {
        response.setHeader("X-Audio-Cache-Key", audio.cacheKey);
      }
      response.send(audio.buffer);
    } catch (error) {
      const status = error instanceof AudioProviderError ? error.statusCode : 400;

      response.status(status).json({
        message: error instanceof Error ? error.message : "Could not generate aligned audio",
      });
    }
  };
}
