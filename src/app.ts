import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { AiController } from "./controllers/ai.controller";
import { AudioController } from "./controllers/audio.controller";
import { AuthController } from "./controllers/auth.controller";
import { ContentController } from "./controllers/content.controller";
import { ConversationController } from "./controllers/conversation.controller";
import { DailyPlanController } from "./controllers/dailyPlan.controller";
import { LearningController } from "./controllers/learning.controller";
import { OnboardingController } from "./controllers/onboarding.controller";
import { PracticeController } from "./controllers/practice.controller";
import { ReviewController } from "./controllers/review.controller";
import { SettingsController } from "./controllers/settings.controller";
import { AuthRepository } from "./repositories/auth.repository";
import { ContentRepository } from "./repositories/content.repository";
import { AiRepository } from "./repositories/ai.repository";
import { AudioCacheRepository } from "./repositories/audioCache.repository";
import { DailyPlanRepository } from "./repositories/dailyPlan.repository";
import { PracticeRepository } from "./repositories/practice.repository";
import { SettingsRepository } from "./repositories/settings.repository";
import { buildRouter } from "./routes";
import { AudioService } from "./services/audio.service";
import { AudioStorageService } from "./services/audioStorage.service";
import { AuthService } from "./services/auth.service";
import { ContentService } from "./services/content.service";
import { ConversationService } from "./services/conversation.service";
import { DailyPlanService } from "./services/dailyPlan.service";
import { LearningService } from "./services/learning.service";
import { OpenAiService } from "./services/openai.service";
import { OnboardingService } from "./services/onboarding.service";
import { PracticeService } from "./services/practice.service";
import { ReviewService } from "./services/review.service";
import { SettingsService } from "./services/settings.service";

const contentRepository = new ContentRepository();
const authRepository = new AuthRepository();
const aiRepository = new AiRepository();
const audioCacheRepository = new AudioCacheRepository();
const dailyPlanRepository = new DailyPlanRepository();
const practiceRepository = new PracticeRepository();
const settingsRepository = new SettingsRepository();

const audioStorageService = new AudioStorageService();
const audioService = new AudioService(
  audioCacheRepository,
  audioStorageService
);
const authService = new AuthService(authRepository);
const settingsService = new SettingsService(settingsRepository);
const openAiService = new OpenAiService(aiRepository, settingsRepository);
const dailyPlanService = new DailyPlanService(dailyPlanRepository);
const conversationService = new ConversationService(openAiService, dailyPlanService);
const learningService = new LearningService();
const reviewService = new ReviewService(contentRepository, dailyPlanService);
const contentService = new ContentService(
  contentRepository,
  dailyPlanService,
  settingsRepository,
  aiRepository
);

const onboardingService = new OnboardingService(dailyPlanService);
const practiceService = new PracticeService(practiceRepository, learningService, dailyPlanService);

const contentController = new ContentController(contentService);
const audioController = new AudioController(audioService);
const authController = new AuthController(authService);
const conversationController = new ConversationController(
  conversationService
);
const reviewController = new ReviewController(reviewService);
const onboardingController = new OnboardingController(
  onboardingService
);
const dailyPlanController = new DailyPlanController(dailyPlanService);
const learningController = new LearningController(learningService);
const aiController = new AiController(openAiService, dailyPlanService);
const practiceController = new PracticeController(practiceService);
const settingsController = new SettingsController(settingsService);

export const app = express();

const allowedOrigins = env.corsOrigin.map((origin) =>
  origin.trim().replace(/\/$/, "")
);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Postman, curl e comunicações servidor-servidor podem não enviar Origin.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/$/, "");
    const isAllowed = allowedOrigins.includes(normalizedOrigin);

    console.log("CORS:", {
      receivedOrigin: normalizedOrigin,
      allowedOrigins,
      isAllowed,
    });

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(
      new Error(`Origem não permitida pelo CORS: ${origin}`)
    );
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

app.use(helmet());

app.use(cors(corsOptions));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));

app.use((req, res, next) => {
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

app.use(
  "/api",
  buildRouter(
    contentController,
    audioController,
    authController,
    conversationController,
    reviewController,
    onboardingController,
    dailyPlanController,
    learningController,
    aiController,
    practiceController,
    settingsController
  )
)