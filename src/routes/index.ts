import { Router } from "express";
import { AiController } from "../controllers/ai.controller";
import { ContentController } from "../controllers/content.controller";
import { ConversationController } from "../controllers/conversation.controller";
import { DailyPlanController } from "../controllers/dailyPlan.controller";
import { OnboardingController } from "../controllers/onboarding.controller";
import { ReviewController } from "../controllers/review.controller";

export const buildRouter = (
  contentController: ContentController,
  conversationController: ConversationController,
  reviewController: ReviewController,
  onboardingController: OnboardingController,
  dailyPlanController: DailyPlanController,
  aiController: AiController
) => {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "english-os-api" });
  });

  router.get("/content/bootstrap", contentController.getBootstrap);
  router.post("/conversations/reply", conversationController.reply);
  router.post("/reviews/record", reviewController.record);
  router.post("/onboarding/plan", onboardingController.createPlan);
  router.get("/daily-plans/today", dailyPlanController.getToday);
  router.patch("/daily-plans/blocks/complete", dailyPlanController.completeBlock);
  router.post("/ai/conversation", aiController.conversation);
  router.post("/ai/dev-mode", aiController.devMode);
  router.post("/ai/think-in-english", aiController.thinkInEnglish);
  router.post("/ai/vocabulary", aiController.vocabulary);
  router.post("/ai/daily-plan", aiController.dailyPlan);
  router.post("/ai/analyze-mistake", aiController.analyzeMistake);

  return router;
};
