import { Request, Response } from "express";
import { OpenAiService } from "../services/openai.service";

const MAX_MESSAGE_LENGTH = 1600;

const sendSafeError = (response: Response, status: number, message: string) => {
  response.status(status).json({ message });
};

const validateUserMessage = (body: { userId?: string; message?: string }, response: Response) => {
  if (!body.userId) {
    sendSafeError(response, 400, "userId is required");
    return false;
  }

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

  conversation = async (request: Request, response: Response) => {
    try {
      if (!validateUserMessage(request.body, response)) return;
      const result = await this.openAiService.generateConversationReply(request.body);
      response.json(result);
    } catch {
      sendSafeError(response, 500, "AI conversation failed");
    }
  };

  devMode = async (request: Request, response: Response) => {
    try {
      if (!validateUserMessage(request.body, response)) return;
      const result = await this.openAiService.generateDeveloperEnglishReply(request.body);
      response.json(result);
    } catch {
      sendSafeError(response, 500, "AI developer mode failed");
    }
  };

  thinkInEnglish = async (request: Request, response: Response) => {
    try {
      if (!validateUserMessage(request.body, response)) return;
      const result = await this.openAiService.generateThinkInEnglishReply(request.body);
      response.json(result);
    } catch {
      sendSafeError(response, 500, "AI think in English failed");
    }
  };

  vocabulary = async (request: Request, response: Response) => {
    try {
      if (!request.body.userId) {
        sendSafeError(response, 400, "userId is required");
        return;
      }

      const result = await this.openAiService.generateVocabularyExamples(request.body);
      response.json(result);
    } catch {
      sendSafeError(response, 500, "AI vocabulary generation failed");
    }
  };

  dailyPlan = async (request: Request, response: Response) => {
    try {
      const { userId, level, goal, dailyMinutes, difficulty } = request.body;

      if (!userId || !level || !goal || !dailyMinutes || !difficulty) {
        sendSafeError(response, 400, "userId, level, goal, dailyMinutes and difficulty are required");
        return;
      }

      const result = await this.openAiService.generateDailyPlan(request.body);
      response.json(result);
    } catch {
      sendSafeError(response, 500, "AI daily plan generation failed");
    }
  };

  analyzeMistake = async (request: Request, response: Response) => {
    try {
      const { userId, sentence } = request.body;

      if (!userId || !sentence?.trim()) {
        sendSafeError(response, 400, "userId and sentence are required");
        return;
      }

      if (sentence.length > MAX_MESSAGE_LENGTH) {
        sendSafeError(response, 400, "sentence is too long");
        return;
      }

      const result = await this.openAiService.analyzeStudentMistake(request.body);
      response.json(result);
    } catch {
      sendSafeError(response, 500, "AI mistake analysis failed");
    }
  };
}
