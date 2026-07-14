import { RequestHandler, Router } from "express";
import multer from "multer";
import { AiController } from "../controllers/ai.controller";
import { AudioController } from "../controllers/audio.controller";
import { AuthController } from "../controllers/auth.controller";
import { ContentController } from "../controllers/content.controller";
import { ConversationController } from "../controllers/conversation.controller";
import { DailyPlanController } from "../controllers/dailyPlan.controller";
import { PracticeController } from "../controllers/practice.controller";
import { ProfilePlanController } from "../controllers/profilePlan.controller";
import { ReviewController } from "../controllers/review.controller";
import { SettingsController } from "../controllers/settings.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { isSupportedSpeakingAudioMime } from "../services/speakingCoachAnalysis.service";

const speakingCoachUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!isSupportedSpeakingAudioMime(file.mimetype)) {
      callback(new Error("Unsupported audio format"));
      return;
    }

    callback(null, true);
  },
}).single("audio");

const handleSpeakingCoachUpload: RequestHandler = (request, response, next) => {
  speakingCoachUpload(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        message: error.code === "LIMIT_FILE_SIZE" ? "Audio file is too large." : error.message,
      });
      return;
    }

    response.status(415).json({
      message: error instanceof Error ? error.message : "Unsupported audio upload",
      status: "processing_error",
    });
  });
};

export const buildRouter = (
  contentController: ContentController,
  audioController: AudioController,
  authController: AuthController,
  conversationController: ConversationController,
  reviewController: ReviewController,
  profilePlanController: ProfilePlanController,
  dailyPlanController: DailyPlanController,
  aiController: AiController,
  practiceController: PracticeController,
  settingsController: SettingsController
) => {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "english-os-api" });
  });

  router.post("/auth/register", authController.register);
  router.post("/auth/login", authController.login);
  router.post("/auth/logout", authController.logout);
  router.get("/auth/me", requireAuth, authController.me);
  router.get("/settings", requireAuth, settingsController.get);
  router.patch("/settings", requireAuth, settingsController.update);

  router.get("/audio/providers", requireAuth, audioController.providers);
  router.post("/audio/speech", requireAuth, audioController.speech);
  router.post("/audio/aligned-speech", requireAuth, audioController.alignedSpeech);
  router.get("/content/bootstrap", requireAuth, contentController.getBootstrap);
  router.post("/conversations/reply", requireAuth, conversationController.reply);
  router.post("/reviews/record", requireAuth, reviewController.record);
  router.post("/profile/plan", requireAuth, profilePlanController.createPlan);
  router.get("/daily-plans/today", requireAuth, dailyPlanController.getToday);
  router.post("/daily-plans/today/advance", requireAuth, dailyPlanController.advanceToday);
  router.patch("/daily-plans/blocks/complete", requireAuth, dailyPlanController.completeBlock);
  router.post("/ai/conversation", requireAuth, aiController.conversation);
  router.post("/ai/dev-mode", requireAuth, aiController.devMode);
  router.post("/ai/think-in-english", requireAuth, aiController.thinkInEnglish);
  router.post("/ai/vocabulary", requireAuth, aiController.vocabulary);
  router.post("/ai/daily-plan", requireAuth, aiController.dailyPlan);
  router.post("/ai/speaking-coach", requireAuth, handleSpeakingCoachUpload, aiController.speakingCoach);
  router.post("/ai/analyze-mistake", requireAuth, aiController.analyzeMistake);
  router.post("/practice/complete", requireAuth, practiceController.complete);
  router.post("/practice/listening-attempts", requireAuth, practiceController.listeningAttempt);

  return router;
};
