import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { AiController } from "./controllers/ai.controller";
import { ContentController } from "./controllers/content.controller";
import { ConversationController } from "./controllers/conversation.controller";
import { DailyPlanController } from "./controllers/dailyPlan.controller";
import { OnboardingController } from "./controllers/onboarding.controller";
import { ReviewController } from "./controllers/review.controller";
import { ContentRepository } from "./repositories/content.repository";
import { AiRepository } from "./repositories/ai.repository";
import { DailyPlanRepository } from "./repositories/dailyPlan.repository";
import { buildRouter } from "./routes";
import { ContentService } from "./services/content.service";
import { ConversationService } from "./services/conversation.service";
import { DailyPlanService } from "./services/dailyPlan.service";
import { OpenAiService } from "./services/openai.service";
import { OnboardingService } from "./services/onboarding.service";
import { ReviewService } from "./services/review.service";

const contentRepository = new ContentRepository();
const aiRepository = new AiRepository();
const dailyPlanRepository = new DailyPlanRepository();
const contentService = new ContentService(contentRepository);
const openAiService = new OpenAiService(aiRepository);
const conversationService = new ConversationService(openAiService);
const reviewService = new ReviewService(contentRepository);
const dailyPlanService = new DailyPlanService(dailyPlanRepository);
const onboardingService = new OnboardingService(dailyPlanService);

const contentController = new ContentController(contentService);
const conversationController = new ConversationController(conversationService);
const reviewController = new ReviewController(reviewService);
const onboardingController = new OnboardingController(onboardingService);
const dailyPlanController = new DailyPlanController(dailyPlanService);
const aiController = new AiController(openAiService);

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
  })
);
app.use(express.json());

app.use(
  "/api",
  buildRouter(
    contentController,
    conversationController,
    reviewController,
    onboardingController,
    dailyPlanController,
    aiController
  )
);
