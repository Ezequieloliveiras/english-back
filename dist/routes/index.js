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
const buildRouter = (contentController, audioController, authController, conversationController, reviewController, profilePlanController, dailyPlanController, aiController, practiceController, settingsController) => {
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
    router.patch("/profile", auth_middleware_1.requireAuth, profilePlanController.updateProfile);
    router.post("/profile/plan", auth_middleware_1.requireAuth, profilePlanController.createPlan);
    router.get("/daily-plans/today", auth_middleware_1.requireAuth, dailyPlanController.getToday);
    router.post("/daily-plans/today/advance", auth_middleware_1.requireAuth, dailyPlanController.advanceToday);
    router.patch("/daily-plans/blocks/complete", auth_middleware_1.requireAuth, dailyPlanController.completeBlock);
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
