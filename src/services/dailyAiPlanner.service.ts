import { AiDailyPlanBlueprint, ContentSemanticMetadata, DailyPlan } from "../types";
import { env } from "../config/env";
import { OpenAiService } from "./openai.service";
import { LearningState } from "./learningState.service";

const allowedModules = new Set(["vocabulary", "listening", "shadowing", "pronunciation", "conversation", "think-in-english"]);
const validSemantic = (value: any): value is ContentSemanticMetadata =>
  value && ["topic", "subtopic", "scenario", "communicativeGoal"].every((key) => typeof value[key] === "string" && value[key].trim()) && Array.isArray(value.keywords);

const localFallback = (plan: DailyPlan): AiDailyPlanBlueprint => ({
  dailyObjective: plan.focus,
  pedagogicalFocus: ["balanced practice"],
  generationSource: "local",
  generationMetadata: { provider: "local", promptVersion: "daily-plan-local-fallback-v1", attempt: 1 },
  activities: plan.blocks.slice(0, 5).map((block, index) => ({
    id: `local-${block.type}-${index + 1}`, module: block.type === "speaking-coach" ? "pronunciation" : block.type === "review" ? "vocabulary" : block.type as any,
    contentMode: block.type === "review" ? "review" : "new", level: "A1",
    semantic: { topic: "general_english", subtopic: block.type, scenario: `${block.type}_practice`, communicativeGoal: "guided_practice", keywords: [block.type] },
    focus: block.objective, reason: "Local fallback while AI planning is unavailable.", status: "planned",
  })),
});

export class DailyAiPlannerService {
  constructor(private readonly openAiService: OpenAiService) {}

  async create(plan: DailyPlan, state: LearningState) {
    if (!env.aiDailyPlanEnabled) return localFallback(plan);
    try {
      const blueprint = await this.openAiService.generateAdaptiveDailyPlan(state);
      const activities = blueprint.activities.filter((activity) => allowedModules.has(activity.module) && validSemantic(activity.semantic)).slice(0, 6);
      if (activities.length < 3 || activities.some((activity) => activity.contentMode === "review" && !state.dueReviews.length) || activities.some((activity) => activity.contentMode === "reinforcement" && !state.listening.weakPatterns.length && !state.speaking.weakPatterns.length)) {
        throw new Error("AI planner proposed an invalid pedagogical blueprint");
      }
      return { ...blueprint, activities };
    } catch (error) {
      console.warn("[ai:daily-plan] using local fallback", error instanceof Error ? error.message : error);
      return localFallback(plan);
    }
  }
}
