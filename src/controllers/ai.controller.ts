import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { DailyPlanService } from "../services/dailyPlan.service";
import { AiProviderError, OpenAiService } from "../services/openai.service";

const MAX_MESSAGE_LENGTH = 1600;

const sendSafeError = (response: Response, status: number, message: string) => {
  response.status(status).json({ message });
};

const sendAiError = (response: Response, error: unknown, fallbackMessage: string) => {
  if (error instanceof AiProviderError) {
    response.status(error.statusCode).json({ message: error.message, status: error.code });
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
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly dailyPlanService?: DailyPlanService
  ) {}

  conversation = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      if (!validateUserMessage(request.body, response)) return;
      const result = await this.openAiService.generateConversationReply({
        ...request.body,
        userId: request.auth.userId,
      });
      await this.dailyPlanService?.recordBlockEvidence({
        userId: request.auth.userId,
        blockType: "conversation",
        evidenceType: "conversation_task",
        evidenceRef: request.body.mode ?? request.body.modeId,
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
      await this.dailyPlanService?.recordBlockEvidence({
        userId: request.auth.userId,
        blockType: "conversation",
        evidenceType: "conversation_task",
        evidenceRef: request.body.scenario ?? "developer-mode",
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
      await this.dailyPlanService?.recordBlockEvidence({
        userId: request.auth.userId,
        blockType: "conversation",
        evidenceType: "conversation_task",
        evidenceRef: request.body.promptId ?? "think-in-english",
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
      await this.dailyPlanService?.recordBlockEvidence({
        userId: request.auth.userId,
        blockType: "vocabulary",
        evidenceType: "vocabulary_recall",
        evidenceRef: request.body.phrase ?? request.body.topic ?? "vocabulary",
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
      const { targetPhrase, focus, context, level } = request.body;

      if (!targetPhrase?.trim()) {
        sendSafeError(response, 400, "targetPhrase is required");
        return;
      }

      if (!request.file?.buffer?.length) {
        sendSafeError(response, 400, "audio file is required");
        return;
      }

      const result = await this.openAiService.analyzeSpeakingCoachAttempt({
        userId: request.auth.userId,
        audioBuffer: request.file.buffer,
        audioMimeType: request.file.mimetype,
        targetPhrase: targetPhrase.trim(),
        focus,
        context,
        level,
      });
      await this.dailyPlanService?.recordBlockEvidence({
        userId: request.auth.userId,
        blockType: "speaking-coach",
        evidenceType: "pronunciation_analysis",
        evidenceRef: targetPhrase.trim(),
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
