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
    const requestId = `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      const { targetPhrase, focus, context, level, activityId } = request.body;

      if (!targetPhrase?.trim()) {
        sendSafeError(response, 400, "targetPhrase is required");
        return;
      }

      if (!request.file?.buffer?.length) {
        sendSafeError(response, 400, "audio file is required");
        return;
      }

      console.info("[ai:speaking-coach] upload accepted", {
        requestId,
        stage: "upload",
        fileSizeBytes: request.file.size,
        mimeType: request.file.mimetype,
      });

      const result = await this.openAiService.analyzeSpeakingCoachAttempt({
        userId: request.auth.userId,
        audioBuffer: request.file.buffer,
        audioMimeType: request.file.mimetype,
        targetPhrase: targetPhrase.trim(),
        focus,
        context,
        level,
        requestId,
      });
      const blockProgress = await this.dailyPlanService?.recordBlockEvidence({
        userId: request.auth.userId,
        blockType: "speaking-coach",
        evidenceType: "pronunciation_analysis",
        evidenceRef: targetPhrase.trim(),
      });
      let activityCompleted = false;
      if (typeof activityId === "string" && activityId.trim()) {
        const updatedPlan = await this.dailyPlanService?.markAiActivityCompleted(
          request.auth.userId,
          activityId.trim(),
          "pronunciation",
        );
        activityCompleted = updatedPlan?.aiBlueprint?.activities.some(
          (activity) => activity.id === activityId.trim() && activity.status === "completed",
        ) ?? false;
      }
      console.info("[ai:speaking-coach] response sent", {
        requestId,
        stage: "response",
        processingMs: Date.now() - startedAt,
      });
      response.json({
        ...result,
        completion: {
          blockCompleted: blockProgress?.dailyPlan.blocks.some(
            (block) => block.type === "speaking-coach" && block.status === "completed",
          ) ?? false,
          activityCompleted,
        },
      });
    } catch (error) {
      console.error("[ai:speaking-coach] request failed", {
        requestId,
        stage: "controller",
        processingMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      });
      sendAiError(response, error, "AI speaking coach analysis failed");
    }
  };

  reviewMeaning = async (request: AuthenticatedRequest, response: Response) => {
    const requestId = `rm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();
    try {
      if (!request.auth?.userId) return sendSafeError(response, 401, "Authentication required");
      const { phrase, expectedMeaning, level } = request.body;

      if (!phrase?.trim()) {
        sendSafeError(response, 400, "phrase is required");
        return;
      }

      if (!expectedMeaning?.trim()) {
        sendSafeError(response, 400, "expectedMeaning is required");
        return;
      }

      if (!request.file?.buffer?.length) {
        sendSafeError(response, 400, "audio file is required");
        return;
      }

      console.info("[ai:review-meaning] upload accepted", {
        requestId,
        stage: "upload",
        fileSizeBytes: request.file.size,
        mimeType: request.file.mimetype,
      });

      const result = await this.openAiService.analyzeReviewMeaningAttempt({
        userId: request.auth.userId,
        audioBuffer: request.file.buffer,
        audioMimeType: request.file.mimetype,
        phrase: phrase.trim(),
        expectedMeaning: expectedMeaning.trim(),
        level,
        requestId,
      });

      console.info("[ai:review-meaning] response sent", {
        requestId,
        stage: "response",
        processingMs: Date.now() - startedAt,
      });

      response.json(result);
    } catch (error) {
      console.error("[ai:review-meaning] request failed", {
        requestId,
        stage: "controller",
        processingMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      });
      sendAiError(response, error, "AI review meaning analysis failed");
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
