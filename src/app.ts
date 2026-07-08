import cors from "cors";
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
import { OnboardingController } from "./controllers/onboarding.controller";
import { PracticeController } from "./controllers/practice.controller";
import { ReviewController } from "./controllers/review.controller";
import { AuthRepository } from "./repositories/auth.repository";
import { ContentRepository } from "./repositories/content.repository";
import { AiRepository } from "./repositories/ai.repository";
import { DailyPlanRepository } from "./repositories/dailyPlan.repository";
import { PracticeRepository } from "./repositories/practice.repository";
import { buildRouter } from "./routes";
import { AudioService } from "./services/audio.service";
import { AuthService } from "./services/auth.service";
import { ContentService } from "./services/content.service";
import { ConversationService } from "./services/conversation.service";
import { DailyPlanService } from "./services/dailyPlan.service";
import { OpenAiService } from "./services/openai.service";
import { OnboardingService } from "./services/onboarding.service";
import { PracticeService } from "./services/practice.service";
import { ReviewService } from "./services/review.service";

const contentRepository = new ContentRepository();
const authRepository = new AuthRepository();
const aiRepository = new AiRepository();
const dailyPlanRepository = new DailyPlanRepository();
const practiceRepository = new PracticeRepository();
const audioService = new AudioService();
const authService = new AuthService(authRepository);
const openAiService = new OpenAiService(aiRepository);
const conversationService = new ConversationService(openAiService);
const reviewService = new ReviewService(contentRepository);
const dailyPlanService = new DailyPlanService(dailyPlanRepository);
const contentService = new ContentService(contentRepository, dailyPlanService);
const onboardingService = new OnboardingService(dailyPlanService);
const practiceService = new PracticeService(practiceRepository);

const contentController = new ContentController(contentService);
const audioController = new AudioController(audioService);
const authController = new AuthController(authService);
const conversationController = new ConversationController(conversationService);
const reviewController = new ReviewController(reviewService);
const onboardingController = new OnboardingController(onboardingService);
const dailyPlanController = new DailyPlanController(dailyPlanService);
const aiController = new AiController(openAiService);
const practiceController = new PracticeController(practiceService);

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(cookieParser());
app.use(express.json());

app.use(cookieParser());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();

  console.log("────────────────────────────────────────");
  console.log(`[${new Date().toISOString()}]`);
  console.log(`${req.method} ${req.originalUrl}`);

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
    aiController,
    practiceController
  )
);
