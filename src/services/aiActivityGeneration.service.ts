import { env } from "../config/env";
import { AiDailyPlanActivity, DailyPlan } from "../types";
import { DailyPlanService } from "./dailyPlan.service";
import { OpenAiService } from "./openai.service";

const sameSemantic = (candidate: any, activity: AiDailyPlanActivity) => {
  const semantic = candidate?.semantic;
  const keys: Array<keyof AiDailyPlanActivity["semantic"]> = ["topic", "subtopic", "scenario", "communicativeGoal"];
  return semantic && keys.every((key) => semantic[key] === activity.semantic[key]);
};

const localContent = (activity: AiDailyPlanActivity) => ({
  semantic: activity.semantic,
  title: activity.focus,
  text: `Practice ${activity.semantic.communicativeGoal.replace(/_/g, " ")} in this situation.`,
  translation: "Pratique o objetivo comunicativo definido para hoje.",
  generationSource: "local_fallback",
});

export class AiActivityGenerationService {
  private readonly inFlight = new Map<string, Promise<any>>();
  constructor(private readonly dailyPlanService: DailyPlanService, private readonly openAiService: OpenAiService) {}

  async getOrGenerate(plan: DailyPlan, activityId: string) {
    const blueprint = plan.aiBlueprint;
    const activity = blueprint?.activities.find((entry) => entry.id === activityId);
    if (!blueprint || !activity) throw new Error("Daily activity not found");
    if (activity.status === "ready" && activity.generatedContent) return { plan, activity };
    const key = `${plan.id}:${activityId}`;
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const task = (async () => {
      const next = structuredClone(blueprint);
      const current = next.activities.find((entry) => entry.id === activityId)!;
      current.status = "generating";
      await this.dailyPlanService.saveAiBlueprint(plan, next);
      try {
        const generated = env.aiContentGenerationEnabled
          ? await this.openAiService.generateBlueprintActivity({ activity: current, recentSemanticHistory: [] })
          : { content: localContent(current), metadata: { provider: "local" as const, promptVersion: `${current.module}-local-fallback-v1`, attempt: 1 } };
        if (!sameSemantic(generated.content, current) && generated.metadata.provider === "openai") throw new Error("Generated activity does not match the persisted blueprint");
        current.generatedContent = generated.content;
        current.generationMetadata = generated.metadata;
        current.status = "ready";
      } catch {
        current.generatedContent = localContent(current);
        current.generationMetadata = { provider: "local", promptVersion: `${current.module}-local-fallback-v1`, attempt: 1 };
        current.status = "ready";
      }
      const saved = await this.dailyPlanService.saveAiBlueprint(plan, next);
      return { plan: saved, activity: saved.aiBlueprint!.activities.find((entry) => entry.id === activityId)! };
    })().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, task);
    return task;
  }
}
