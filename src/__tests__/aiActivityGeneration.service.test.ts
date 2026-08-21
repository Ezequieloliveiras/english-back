import { describe, expect, it } from "@jest/globals";
import { AiActivityGenerationService } from "../services/aiActivityGeneration.service";
import { DailyPlan } from "../types";

const plan: DailyPlan = {
  id: "plan", userId: "user", date: "2026-08-21", focus: "Focus", totalMinutes: 10, streak: 0, blocks: [],
  aiBlueprint: { dailyObjective: "Practice", pedagogicalFocus: ["listening"], generationSource: "local", generationMetadata: { provider: "local", promptVersion: "test", attempt: 1 }, activities: [{ id: "listening-1", module: "listening", contentMode: "new", level: "A2", semantic: { topic: "transportation", subtopic: "train_station", scenario: "checking_time", communicativeGoal: "understanding_time", keywords: ["train"] }, focus: "Times", reason: "Test", status: "planned" }] },
};

describe("lazy AI activity generation", () => {
  it("persists and reuses the generated activity instead of generating twice", async () => {
    let saves = 0;
    const savedPlan = { ...plan };
    const service = new AiActivityGenerationService({ saveAiBlueprint: async (_plan: DailyPlan, blueprint: any) => { saves++; savedPlan.aiBlueprint = blueprint; return savedPlan; } } as any, { generateBlueprintActivity: async () => { throw new Error("feature flag fallback expected"); } } as any);
    const first = await service.getOrGenerate(savedPlan, "listening-1");
    const second = await service.getOrGenerate(first.plan, "listening-1");
    expect(first.activity.status).toBe("ready");
    expect(second.activity.generatedContent).toEqual(first.activity.generatedContent);
    expect(saves).toBe(2);
  });
});
