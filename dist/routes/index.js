"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRouter = void 0;
const express_1 = require("express");
const buildRouter = (contentController, conversationController, reviewController, onboardingController, dailyPlanController, aiController) => {
    const router = (0, express_1.Router)();
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
exports.buildRouter = buildRouter;
