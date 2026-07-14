import { RequestHandler, Router } from "express";
import multer from "multer";
import { AiController } from "../controllers/ai.controller";
import { AudioController } from "../controllers/audio.controller";
import { AuthController } from "../controllers/auth.controller";
import { ContentController } from "../controllers/content.controller";
import { ConversationController } from "../controllers/conversation.controller";
import { DailyPlanController } from "../controllers/dailyPlan.controller";
import { LearningController } from "../controllers/learning.controller";
import { OnboardingController } from "../controllers/onboarding.controller";
import { PracticeController } from "../controllers/practice.controller";
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
  onboardingController: OnboardingController,
  dailyPlanController: DailyPlanController,
  learningController: LearningController,
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
  router.post("/onboarding/plan", requireAuth, onboardingController.createPlan);
  router.get("/daily-plans/today", requireAuth, dailyPlanController.getToday);
  router.post("/daily-plans/today/advance", requireAuth, dailyPlanController.advanceToday);
  router.patch("/daily-plans/blocks/complete", requireAuth, dailyPlanController.completeBlock);
  router.get("/learning/roadmap", requireAuth, learningController.roadmap);
  router.get("/learning/levels", requireAuth, learningController.levels);
  router.get("/learning/levels/:level", requireAuth, learningController.level);
  router.get("/learning/competencies", requireAuth, learningController.competencies);
  router.get("/learning/competencies/:id", requireAuth, learningController.competency);
  router.get("/learning/units", requireAuth, learningController.units);
  router.get("/learning/units/:id", requireAuth, learningController.unit);
  router.get("/users/me/competency-profile", requireAuth, learningController.competencyProfile);
  router.get("/users/me/level-progress", requireAuth, learningController.levelProgress);
  router.get("/users/me/roadmap", requireAuth, learningController.userRoadmap);
  router.get("/users/me/daily-learning-context", requireAuth, learningController.dailyLearningContext);
  router.post("/users/me/diagnostic/start", requireAuth, learningController.diagnosticStart);
  router.post("/users/me/diagnostic/submit", requireAuth, learningController.diagnosticSubmit);
  router.post("/users/me/diagnostic/finish", requireAuth, learningController.diagnosticFinish);
  router.post("/learning/attempts", requireAuth, learningController.learningAttempt);
  router.post("/learning/competencies/:id/evidence", requireAuth, learningController.evidence);
  router.post("/learning/checkpoints/:id/start", requireAuth, learningController.checkpointStart);
  router.post("/learning/checkpoints/:id/submit", requireAuth, learningController.checkpointSubmit);
  router.post("/learning/checkpoints/:id/finish", requireAuth, learningController.checkpointFinish);
  router.post("/users/me/daily-plan/generate", requireAuth, learningController.generateDailyPlan);
  router.post("/users/me/daily-plan/refine", requireAuth, learningController.refineDailyPlan);
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
