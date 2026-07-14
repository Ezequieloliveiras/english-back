"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const ai_controller_1 = require("./controllers/ai.controller");
const audio_controller_1 = require("./controllers/audio.controller");
const auth_controller_1 = require("./controllers/auth.controller");
const content_controller_1 = require("./controllers/content.controller");
const conversation_controller_1 = require("./controllers/conversation.controller");
const dailyPlan_controller_1 = require("./controllers/dailyPlan.controller");
const practice_controller_1 = require("./controllers/practice.controller");
const profilePlan_controller_1 = require("./controllers/profilePlan.controller");
const review_controller_1 = require("./controllers/review.controller");
const settings_controller_1 = require("./controllers/settings.controller");
const auth_repository_1 = require("./repositories/auth.repository");
const content_repository_1 = require("./repositories/content.repository");
const ai_repository_1 = require("./repositories/ai.repository");
const audioCache_repository_1 = require("./repositories/audioCache.repository");
const dailyPlan_repository_1 = require("./repositories/dailyPlan.repository");
const practice_repository_1 = require("./repositories/practice.repository");
const settings_repository_1 = require("./repositories/settings.repository");
const routes_1 = require("./routes");
const audio_service_1 = require("./services/audio.service");
const audioStorage_service_1 = require("./services/audioStorage.service");
const auth_service_1 = require("./services/auth.service");
const content_service_1 = require("./services/content.service");
const conversation_service_1 = require("./services/conversation.service");
const dailyPlan_service_1 = require("./services/dailyPlan.service");
const openai_service_1 = require("./services/openai.service");
const practice_service_1 = require("./services/practice.service");
const profilePlan_service_1 = require("./services/profilePlan.service");
const review_service_1 = require("./services/review.service");
const settings_service_1 = require("./services/settings.service");
const contentRepository = new content_repository_1.ContentRepository();
const authRepository = new auth_repository_1.AuthRepository();
const aiRepository = new ai_repository_1.AiRepository();
const audioCacheRepository = new audioCache_repository_1.AudioCacheRepository();
const dailyPlanRepository = new dailyPlan_repository_1.DailyPlanRepository();
const practiceRepository = new practice_repository_1.PracticeRepository();
const settingsRepository = new settings_repository_1.SettingsRepository();
const audioStorageService = new audioStorage_service_1.AudioStorageService();
const audioService = new audio_service_1.AudioService(audioCacheRepository, audioStorageService);
const authService = new auth_service_1.AuthService(authRepository);
const settingsService = new settings_service_1.SettingsService(settingsRepository);
const openAiService = new openai_service_1.OpenAiService(aiRepository, settingsRepository);
const dailyPlanService = new dailyPlan_service_1.DailyPlanService(dailyPlanRepository);
const conversationService = new conversation_service_1.ConversationService(openAiService, dailyPlanService);
const reviewService = new review_service_1.ReviewService(contentRepository, dailyPlanService);
const contentService = new content_service_1.ContentService(contentRepository, dailyPlanService, settingsRepository, aiRepository, practiceRepository);
const profilePlanService = new profilePlan_service_1.ProfilePlanService(dailyPlanService);
const practiceService = new practice_service_1.PracticeService(practiceRepository, dailyPlanService);
const contentController = new content_controller_1.ContentController(contentService);
const audioController = new audio_controller_1.AudioController(audioService);
const authController = new auth_controller_1.AuthController(authService);
const conversationController = new conversation_controller_1.ConversationController(conversationService);
const reviewController = new review_controller_1.ReviewController(reviewService);
const profilePlanController = new profilePlan_controller_1.ProfilePlanController(profilePlanService);
const dailyPlanController = new dailyPlan_controller_1.DailyPlanController(dailyPlanService);
const aiController = new ai_controller_1.AiController(openAiService, dailyPlanService);
const practiceController = new practice_controller_1.PracticeController(practiceService);
const settingsController = new settings_controller_1.SettingsController(settingsService);
exports.app = (0, express_1.default)();
const allowedOrigins = env_1.env.corsOrigin.map((origin) => origin.trim().replace(/\/$/, ""));
const corsOptions = {
    origin(origin, callback) {
        // Postman, curl e comunicações servidor-servidor podem não enviar Origin.
        if (!origin) {
            return callback(null, true);
        }
        const normalizedOrigin = origin.trim().replace(/\/$/, "");
        const isAllowed = allowedOrigins.includes(normalizedOrigin);
        if (isAllowed) {
            return callback(null, true);
        }
        return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
    exposedHeaders: [
        "X-Audio-Cache",
        "X-Audio-Cacheable",
        "X-Audio-Expires-At",
        "X-Audio-Cache-Key",
    ],
    optionsSuccessStatus: 204,
};
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)(corsOptions));
exports.app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
}));
exports.app.use((0, cookie_parser_1.default)());
exports.app.use(express_1.default.json({ limit: "15mb" }));
exports.app.use((req, res, next) => {
    const start = Date.now();
    console.log("────────────────────────────────────────");
    console.log(`[${new Date().toISOString()}]`);
    console.log(`${req.method} ${req.originalUrl}`);
    console.log("Origin:", req.headers.origin ?? "sem origin");
    res.on("finish", () => {
        console.log(`→ ${res.statusCode} (${Date.now() - start}ms)`);
        console.log("────────────────────────────────────────");
    });
    next();
});
exports.app.use("/api", (0, routes_1.buildRouter)(contentController, audioController, authController, conversationController, reviewController, profilePlanController, dailyPlanController, aiController, practiceController, settingsController));
