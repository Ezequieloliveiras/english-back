import { Response } from "express";
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
      response.send(audio.buffer);
    } catch (error) {
      const status = error instanceof AudioProviderError ? error.statusCode : 400;

      response.status(status).json({
        message: error instanceof Error ? error.message : "Could not generate audio",
      });
    }
  };
}
