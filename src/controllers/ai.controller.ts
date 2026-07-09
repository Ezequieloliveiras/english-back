import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AiProviderError, OpenAiService } from "../services/openai.service";

const MAX_MESSAGE_LENGTH = 1600;

const sendSafeError = (response: Response, status: number, message: string) => {
  response.status(status).json({ message });
};

const sendAiError = (response: Response, error: unknown, fallbackMessage: string) => {
  if (error instanceof AiProviderError) {
    sendSafeError(response, error.statusCode, error.message);
    return;
  }

  sendSafeError(response, 500, fallbackMessage);
};

const validateUserMessage = (body: { message?: string }, response: Response) => {
  if (!body.message?.trim()) {
    sendSafeError(response, 400, "message is required");
    return false;
  }

  if (body.message.length > MAX_MESSAGE_LENGTH) {
    sendSafeError(response, 400, "message is too long");
    return false;
  }

  return true;
};

export class AiController {
  constructor(private readonly openAiService: OpenAiService) {}

  conversation = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      if (!validateUserMessage(request.body, response)) return;
      const result = await this.openAiService.generateConversationReply({
        ...request.body,
        userId: request.auth.userId,
      });
      response.json(result);
    } catch (error) {
      sendAiError(response, error, "AI conversation failed");
    }
  };

  devMode = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      if (!validateUserMessage(request.body, response)) return;
      const result = await this.openAiService.generateDeveloperEnglishReply({
        ...request.body,
        userId: request.auth.userId,
      });
      response.json(result);
    } catch (error) {
      sendAiError(response, error, "AI developer mode failed");
    }
  };

  thinkInEnglish = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      if (!validateUserMessage(request.body, response)) return;
      const result = await this.openAiService.generateThinkInEnglishReply({
        ...request.body,
        userId: request.auth.userId,
      });
      response.json(result);
    } catch (error) {
      sendAiError(response, error, "AI think in English failed");
    }
  };

  vocabulary = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      const result = await this.openAiService.generateVocabularyExamples({
        ...request.body,
        userId: request.auth.userId,
      });
      response.json(result);
    } catch (error) {
      sendAiError(response, error, "AI vocabulary generation failed");
    }
  };

  dailyPlan = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      const { level, goal, dailyMinutes, difficulty } = request.body;

      if (!level || !goal || !dailyMinutes || !difficulty) {
        sendSafeError(response, 400, "level, goal, dailyMinutes and difficulty are required");
        return;
      }

      const result = await this.openAiService.generateDailyPlan({
        ...request.body,
        userId: request.auth.userId,
      });
      response.json(result);
    } catch (error) {
      sendAiError(response, error, "AI daily plan generation failed");
    }
  };

  speakingCoach = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      const { audioBase64, targetPhrase, focus, context, level, audioMimeType } = request.body;

      if (!audioBase64?.trim()) {
        sendSafeError(response, 400, "audioBase64 is required");
        return;
      }

      if (!targetPhrase?.trim()) {
        sendSafeError(response, 400, "targetPhrase is required");
        return;
      }

      const result = await this.openAiService.analyzeSpeakingCoachAttempt({
        userId: request.auth.userId,
        audioBase64,
        audioMimeType,
        targetPhrase,
        focus,
        context,
        level,
      });
      response.json(result);
    } catch (error) {
      sendAiError(response, error, "AI speaking coach analysis failed");
    }
  };

  analyzeMistake = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      const { sentence } = request.body;

      if (!sentence?.trim()) {
        sendSafeError(response, 400, "sentence is required");
        return;
      }

      if (sentence.length > MAX_MESSAGE_LENGTH) {
        sendSafeError(response, 400, "sentence is too long");
        return;
      }

      const result = await this.openAiService.analyzeStudentMistake({
        ...request.body,
        userId: request.auth.userId,
      });
      response.json(result);
    } catch (error) {
      sendAiError(response, error, "AI mistake analysis failed");
    }
  };
}
