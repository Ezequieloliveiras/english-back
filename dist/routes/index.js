"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const speakingCoachAnalysis_service_1 = require("../services/speakingCoachAnalysis.service");
const speakingCoachUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
        if (!(0, speakingCoachAnalysis_service_1.isSupportedSpeakingAudioMime)(file.mimetype)) {
            callback(new Error("Unsupported audio format"));
            return;
        }
        callback(null, true);
    },
}).single("audio");
const handleSpeakingCoachUpload = (request, response, next) => {
    speakingCoachUpload(request, response, (error) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof multer_1.default.MulterError) {
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
const buildRouter = (contentController, audioController, authController, conversationController, reviewController, onboardingController, dailyPlanController, learningController, aiController, practiceController, settingsController) => {
    const router = (0, express_1.Router)();
    router.get("/health", (_request, response) => {
        response.json({ status: "ok", service: "english-os-api" });
    });
    router.post("/auth/register", authController.register);
    router.post("/auth/login", authController.login);
    router.post("/auth/logout", authController.logout);
    router.get("/auth/me", auth_middleware_1.requireAuth, authController.me);
    router.get("/settings", auth_middleware_1.requireAuth, settingsController.get);
    router.patch("/settings", auth_middleware_1.requireAuth, settingsController.update);
    router.get("/audio/providers", auth_middleware_1.requireAuth, audioController.providers);
    router.post("/audio/speech", auth_middleware_1.requireAuth, audioController.speech);
    router.post("/audio/aligned-speech", auth_middleware_1.requireAuth, audioController.alignedSpeech);
    router.get("/content/bootstrap", auth_middleware_1.requireAuth, contentController.getBootstrap);
    router.post("/conversations/reply", auth_middleware_1.requireAuth, conversationController.reply);
    router.post("/reviews/record", auth_middleware_1.requireAuth, reviewController.record);
    router.post("/onboarding/plan", auth_middleware_1.requireAuth, onboardingController.createPlan);
    router.get("/daily-plans/today", auth_middleware_1.requireAuth, dailyPlanController.getToday);
    router.post("/daily-plans/today/advance", auth_middleware_1.requireAuth, dailyPlanController.advanceToday);
    router.patch("/daily-plans/blocks/complete", auth_middleware_1.requireAuth, dailyPlanController.completeBlock);
    router.get("/learning/roadmap", auth_middleware_1.requireAuth, learningController.roadmap);
    router.get("/learning/levels", auth_middleware_1.requireAuth, learningController.levels);
    router.get("/learning/levels/:level", auth_middleware_1.requireAuth, learningController.level);
    router.get("/learning/competencies", auth_middleware_1.requireAuth, learningController.competencies);
    router.get("/learning/competencies/:id", auth_middleware_1.requireAuth, learningController.competency);
    router.get("/learning/units", auth_middleware_1.requireAuth, learningController.units);
    router.get("/learning/units/:id", auth_middleware_1.requireAuth, learningController.unit);
    router.get("/users/me/competency-profile", auth_middleware_1.requireAuth, learningController.competencyProfile);
    router.get("/users/me/level-progress", auth_middleware_1.requireAuth, learningController.levelProgress);
    router.get("/users/me/roadmap", auth_middleware_1.requireAuth, learningController.userRoadmap);
    router.get("/users/me/daily-learning-context", auth_middleware_1.requireAuth, learningController.dailyLearningContext);
    router.post("/users/me/diagnostic/start", auth_middleware_1.requireAuth, learningController.diagnosticStart);
    router.post("/users/me/diagnostic/submit", auth_middleware_1.requireAuth, learningController.diagnosticSubmit);
    router.post("/users/me/diagnostic/finish", auth_middleware_1.requireAuth, learningController.diagnosticFinish);
    router.post("/learning/attempts", auth_middleware_1.requireAuth, learningController.learningAttempt);
    router.post("/learning/competencies/:id/evidence", auth_middleware_1.requireAuth, learningController.evidence);
    router.post("/learning/checkpoints/:id/start", auth_middleware_1.requireAuth, learningController.checkpointStart);
    router.post("/learning/checkpoints/:id/submit", auth_middleware_1.requireAuth, learningController.checkpointSubmit);
    router.post("/learning/checkpoints/:id/finish", auth_middleware_1.requireAuth, learningController.checkpointFinish);
    router.post("/users/me/daily-plan/generate", auth_middleware_1.requireAuth, learningController.generateDailyPlan);
    router.post("/users/me/daily-plan/refine", auth_middleware_1.requireAuth, learningController.refineDailyPlan);
    router.post("/ai/conversation", auth_middleware_1.requireAuth, aiController.conversation);
    router.post("/ai/dev-mode", auth_middleware_1.requireAuth, aiController.devMode);
    router.post("/ai/think-in-english", auth_middleware_1.requireAuth, aiController.thinkInEnglish);
    router.post("/ai/vocabulary", auth_middleware_1.requireAuth, aiController.vocabulary);
    router.post("/ai/daily-plan", auth_middleware_1.requireAuth, aiController.dailyPlan);
    router.post("/ai/speaking-coach", auth_middleware_1.requireAuth, handleSpeakingCoachUpload, aiController.speakingCoach);
    router.post("/ai/analyze-mistake", auth_middleware_1.requireAuth, aiController.analyzeMistake);
    router.post("/practice/complete", auth_middleware_1.requireAuth, practiceController.complete);
    router.post("/practice/listening-attempts", auth_middleware_1.requireAuth, practiceController.listeningAttempt);
    return router;
};
exports.buildRouter = buildRouter;
