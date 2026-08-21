"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiActivityGenerationService = void 0;
const env_1 = require("../config/env");
const sameSemantic = (candidate, activity) => {
    const semantic = candidate?.semantic;
    const keys = ["topic", "subtopic", "scenario", "communicativeGoal"];
    return semantic && keys.every((key) => semantic[key] === activity.semantic[key]);
};
const localContent = (activity) => ({
    semantic: activity.semantic,
    title: activity.focus,
    text: `Practice ${activity.semantic.communicativeGoal.replace(/_/g, " ")} in this situation.`,
    translation: "Pratique o objetivo comunicativo definido para hoje.",
    generationSource: "local_fallback",
});
class AiActivityGenerationService {
    constructor(dailyPlanService, openAiService) {
        this.dailyPlanService = dailyPlanService;
        this.openAiService = openAiService;
        this.inFlight = new Map();
    }
    async getOrGenerate(plan, activityId) {
        const blueprint = plan.aiBlueprint;
        const activity = blueprint?.activities.find((entry) => entry.id === activityId);
        if (!blueprint || !activity)
            throw new Error("Daily activity not found");
        if (activity.status === "ready" && activity.generatedContent)
            return { plan, activity };
        const key = `${plan.id}:${activityId}`;
        const pending = this.inFlight.get(key);
        if (pending)
            return pending;
        const task = (async () => {
            const next = structuredClone(blueprint);
            const current = next.activities.find((entry) => entry.id === activityId);
            current.status = "generating";
            await this.dailyPlanService.saveAiBlueprint(plan, next);
            try {
                const generated = env_1.env.aiContentGenerationEnabled
                    ? await this.openAiService.generateBlueprintActivity({ activity: current, recentSemanticHistory: [] })
                    : { content: localContent(current), metadata: { provider: "local", promptVersion: `${current.module}-local-fallback-v1`, attempt: 1 } };
                if (!sameSemantic(generated.content, current) && generated.metadata.provider === "openai")
                    throw new Error("Generated activity does not match the persisted blueprint");
                current.generatedContent = generated.content;
                current.generationMetadata = generated.metadata;
                current.status = "ready";
            }
            catch {
                current.generatedContent = localContent(current);
                current.generationMetadata = { provider: "local", promptVersion: `${current.module}-local-fallback-v1`, attempt: 1 };
                current.status = "ready";
            }
            const saved = await this.dailyPlanService.saveAiBlueprint(plan, next);
            return { plan: saved, activity: saved.aiBlueprint.activities.find((entry) => entry.id === activityId) };
        })().finally(() => this.inFlight.delete(key));
        this.inFlight.set(key, task);
        return task;
    }
}
exports.AiActivityGenerationService = AiActivityGenerationService;
