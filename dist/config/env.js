"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 4000),
    mongoUri: process.env.MONGODB_URI ??
        "mongodb://localhost:27017/english-os",
    jwtSecret: process.env.JWT_SECRET ?? "change-me",
    corsOrigin: (process.env.CORS_ORIGIN?.split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean)) ?? [
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
    openAiPlannerModel: process.env.OPENAI_PLANNER_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    openAiContentModel: process.env.OPENAI_CONTENT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    openAiAnalysisModel: process.env.OPENAI_ANALYSIS_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    aiDailyPlanEnabled: process.env.AI_DAILY_PLAN_ENABLED === "true",
    aiContentGenerationEnabled: process.env.AI_CONTENT_GENERATION_ENABLED === "true",
    authCookieName: process.env.AUTH_COOKIE_NAME ?? "english_os_session",
    voiceProviderEndpoint: process.env.VOICE_PROVIDER_ENDPOINT ?? "",
    voiceProviderApiKey: process.env.VOICE_PROVIDER_API_KEY ?? "",
};
