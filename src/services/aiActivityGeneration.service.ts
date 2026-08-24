import { env } from "../config/env";
import { AiDailyPlanActivity, DailyPlan } from "../types";
import { DailyPlanService } from "./dailyPlan.service";
import { OpenAiService } from "./openai.service";

const sameSemantic = (candidate: any, activity: AiDailyPlanActivity) => {
  const semantic = candidate?.semantic;
  const keys: Array<keyof AiDailyPlanActivity["semantic"]> = ["topic", "subtopic", "scenario", "communicativeGoal"];
  return semantic && keys.every((key) => semantic[key] === activity.semantic[key]);
};

const localContent = (activity: AiDailyPlanActivity) => {
  const base = {
    semantic: activity.semantic,
    title: activity.focus,
    generationSource: "local_fallback",
  };

  if (activity.module === "listening") {
    return {
      ...base,
      level: activity.level,
      dialogue: [
        "Maya: Can you give me a quick update on this task?",
        "Leo: Yes. I finished the main part, and I will check the details this afternoon.",
        "Maya: Great. Please let me know if you need any help.",
      ],
      transcript: "Maya asks Leo for a task update. Leo says the main part is finished and he will check the details later.",
      questions: [
        { prompt: "What has Leo finished?", answer: "The main part of the task.", acceptableAnswers: ["The main part", "The main part of the task"], explanation: "Listen for 'I finished the main part'." },
        { prompt: "What will Leo do this afternoon?", answer: "Check the details.", acceptableAnswers: ["Check the details", "He will check the details"], explanation: "Listen for 'I will check the details this afternoon'." },
      ],
    };
  }

  if (activity.module === "shadowing") {
    return { ...base, items: [
      { text: "Can you give me a quick update?", translation: "Você pode me dar uma atualização rápida?", pronunciationTip: "Conecte 'give me' de forma suave.", rhythmNote: "Dê ênfase em quick e update." },
      { text: "I finished the main part of the task.", translation: "Terminei a parte principal da tarefa.", pronunciationTip: "Pratique o final de finished.", rhythmNote: "Mantenha main part unido." },
      { text: "I will check the details this afternoon.", translation: "Vou verificar os detalhes esta tarde.", pronunciationTip: "Reduza will em fala natural.", rhythmNote: "Dê ênfase em check e details." },
    ] };
  }

  if (activity.module === "conversation") {
    return {
      ...base,
      title: "Task update with a teammate",
      scenario: "task update with a teammate",
      assistantRole: "a helpful coworker",
      studentRole: "a professional practicing English",
      studentGoal: "Give a short update, add one detail, and ask your teammate a follow-up question.",
      targetStructures: ["I am working on...", "I finished...", "I will..."],
      successCriteria: ["Answer the question", "Add one useful detail", "Ask a follow-up question"],
      openingMessage: "Hi! I’m your teammate. I’m checking in on a task we are working on. What are you working on today?",
    };
  }

  return {
    ...base,
    text: `Practice ${activity.semantic.communicativeGoal.replace(/_/g, " ")} in this situation.`,
    translation: "Pratique o objetivo comunicativo definido para hoje.",
  };
};

const hasUsableContent = (activity: AiDailyPlanActivity) => {
  if (!activity.generatedContent || typeof activity.generatedContent !== "object") return false;
  const content = activity.generatedContent as any;
  if (activity.module === "listening") return Array.isArray(content.dialogue) && content.dialogue.length > 0;
  if (activity.module === "shadowing") return Array.isArray(content.items) && content.items.length > 0;
  if (activity.module === "conversation") {
    return typeof content.openingMessage === "string" && content.openingMessage.trim().length > 0 && content.scenario !== "conversation_practice";
  }
  return true;
};

export class AiActivityGenerationService {
  private readonly inFlight = new Map<string, Promise<any>>();
  constructor(private readonly dailyPlanService: DailyPlanService, private readonly openAiService: OpenAiService) {}

  async getOrGenerate(plan: DailyPlan, activityId: string) {
    const blueprint = plan.aiBlueprint;
    const activity = blueprint?.activities.find((entry) => entry.id === activityId);
    if (!blueprint || !activity) throw new Error("Daily activity not found");
    // Older generic fallbacks had no dialogue/items. Regenerate them instead of
    // returning a page that looks loaded but contains zero exercises.
    if (activity.status === "ready" && hasUsableContent(activity)) return { plan, activity };
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
        if ((!sameSemantic(generated.content, current) && generated.metadata.provider === "openai") || !hasUsableContent({ ...current, generatedContent: generated.content })) {
          throw new Error("Generated activity does not meet the persisted activity contract");
        }
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
