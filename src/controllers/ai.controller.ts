import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { OpenAiService } from "../services/openai.service";

const MAX_MESSAGE_LENGTH = 1600;

const sendSafeError = (response: Response, status: number, message: string) => {
  response.status(status).json({ message });
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
    } catch {
      sendSafeError(response, 500, "AI conversation failed");
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
    } catch {
      sendSafeError(response, 500, "AI developer mode failed");
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
    } catch {
      sendSafeError(response, 500, "AI think in English failed");
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
    } catch {
      sendSafeError(response, 500, "AI vocabulary generation failed");
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
    } catch {
      sendSafeError(response, 500, "AI daily plan generation failed");
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
    } catch {
      sendSafeError(response, 500, "AI mistake analysis failed");
    }
  };
}
