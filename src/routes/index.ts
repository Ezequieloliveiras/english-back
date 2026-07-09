import { Router } from "express";
import { AiController } from "../controllers/ai.controller";
import { AudioController } from "../controllers/audio.controller";
import { AuthController } from "../controllers/auth.controller";
import { ContentController } from "../controllers/content.controller";
import { ConversationController } from "../controllers/conversation.controller";
import { DailyPlanController } from "../controllers/dailyPlan.controller";
import { OnboardingController } from "../controllers/onboarding.controller";
import { PracticeController } from "../controllers/practice.controller";
import { ReviewController } from "../controllers/review.controller";
import { SettingsController } from "../controllers/settings.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const buildRouter = (
  contentController: ContentController,
  audioController: AudioController,
  authController: AuthController,
  conversationController: ConversationController,
  reviewController: ReviewController,
  onboardingController: OnboardingController,
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
  router.get("/content/bootstrap", requireAuth, contentController.getBootstrap);
  router.post("/conversations/reply", requireAuth, conversationController.reply);
  router.post("/reviews/record", requireAuth, reviewController.record);
  router.post("/onboarding/plan", requireAuth, onboardingController.createPlan);
  router.get("/daily-plans/today", requireAuth, dailyPlanController.getToday);
  router.patch("/daily-plans/blocks/complete", requireAuth, dailyPlanController.completeBlock);
  router.post("/ai/conversation", requireAuth, aiController.conversation);
  router.post("/ai/dev-mode", requireAuth, aiController.devMode);
  router.post("/ai/think-in-english", requireAuth, aiController.thinkInEnglish);
  router.post("/ai/vocabulary", requireAuth, aiController.vocabulary);
  router.post("/ai/daily-plan", requireAuth, aiController.dailyPlan);
  router.post("/ai/speaking-coach", requireAuth, aiController.speakingCoach);
  router.post("/ai/analyze-mistake", requireAuth, aiController.analyzeMistake);
  router.post("/practice/complete", requireAuth, practiceController.complete);

  return router;
};
