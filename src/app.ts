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
import { PracticeController } from "./controllers/practice.controller";
import { ProfilePlanController } from "./controllers/profilePlan.controller";
import { ReviewController } from "./controllers/review.controller";
import { SettingsController } from "./controllers/settings.controller";
import { AuthRepository } from "./repositories/auth.repository";
import { ContentRepository } from "./repositories/content.repository";
import { AiRepository } from "./repositories/ai.repository";
import { AudioCacheRepository } from "./repositories/audioCache.repository";
import { DailyPlanRepository } from "./repositories/dailyPlan.repository";
import { PracticeRepository } from "./repositories/practice.repository";
import { ProgressRepository } from "./repositories/progress.repository";
import { SettingsRepository } from "./repositories/settings.repository";
import { UserGoalRepository } from "./repositories/userGoal.repository";
import { buildRouter } from "./routes";
import { AudioService } from "./services/audio.service";
import { AudioStorageService } from "./services/audioStorage.service";
import { AuthService } from "./services/auth.service";
import { ContentService } from "./services/content.service";
import { ConversationService } from "./services/conversation.service";
import { DailyPlanService } from "./services/dailyPlan.service";
import { OpenAiService } from "./services/openai.service";
import { LearningPreferencesService } from "./services/learningPreferences.service";
import { PracticeService } from "./services/practice.service";
import { ProgressService } from "./services/progress.service";
import { ProfilePlanService } from "./services/profilePlan.service";
import { ReviewService } from "./services/review.service";
import { SettingsService } from "./services/settings.service";

const contentRepository = new ContentRepository();
const authRepository = new AuthRepository();
const aiRepository = new AiRepository();
const audioCacheRepository = new AudioCacheRepository();
const dailyPlanRepository = new DailyPlanRepository();
const practiceRepository = new PracticeRepository();
const progressRepository = new ProgressRepository();
const userGoalRepository = new UserGoalRepository();
const settingsRepository = new SettingsRepository(userGoalRepository);

const audioStorageService = new AudioStorageService();
const settingsService = new SettingsService(settingsRepository);
const learningPreferencesService = new LearningPreferencesService(settingsRepository);
const audioService = new AudioService(
  audioCacheRepository,
  audioStorageService,
  learningPreferencesService
);
const authService = new AuthService(authRepository);
const progressService = new ProgressService(progressRepository);
const openAiService = new OpenAiService(aiRepository, learningPreferencesService, progressService);
const dailyPlanService = new DailyPlanService(dailyPlanRepository, progressService);
const conversationService = new ConversationService(openAiService, dailyPlanService);
const reviewService = new ReviewService(contentRepository, dailyPlanService, progressService);
const contentService = new ContentService(
  contentRepository,
  dailyPlanService,
  settingsRepository,
  aiRepository,
  practiceRepository,
  progressService,
  userGoalRepository
);

const profilePlanService = new ProfilePlanService(dailyPlanService, userGoalRepository);
const practiceService = new PracticeService(practiceRepository, dailyPlanService, progressService);

const contentController = new ContentController(contentService);
const audioController = new AudioController(audioService);
const authController = new AuthController(authService);
const conversationController = new ConversationController(
  conversationService
);
const reviewController = new ReviewController(reviewService);
const profilePlanController = new ProfilePlanController(
  profilePlanService
);
const dailyPlanController = new DailyPlanController(dailyPlanService);
const aiController = new AiController(openAiService, dailyPlanService);
const practiceController = new PracticeController(practiceService);
const settingsController = new SettingsController(settingsService);

export const app = express();

const allowedOrigins = env.corsOrigin.map((origin) =>
  origin.trim().replace(/\/$/, "")
);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Postman, curl e comunicaÃ§Ãµes servidor-servidor podem nÃ£o enviar Origin.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/$/, "");
    const isAllowed = allowedOrigins.includes(normalizedOrigin);

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(
      new Error(`Origem nÃ£o permitida pelo CORS: ${origin}`)
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
  const logSeparator = "-".repeat(40);

  console.log(logSeparator);
  console.log(`[${new Date().toISOString()}]`);
  console.log(`${req.method} ${req.originalUrl}`);
  console.log("Origin:", req.headers.origin ?? "sem origin");

  res.on("finish", () => {
    console.log(`-> ${res.statusCode} (${Date.now() - start}ms)`);
    console.log(logSeparator);
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
    profilePlanController,
    dailyPlanController,
    aiController,
    practiceController,
    settingsController
  )
)


