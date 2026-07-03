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
    mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/english-os",
    jwtSecret: process.env.JWT_SECRET ?? "change-me",
    corsOrigin: process.env.CORS_ORIGIN?.split(",") ?? [
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
    authCookieName: process.env.AUTH_COOKIE_NAME ?? "english_os_session",
};
