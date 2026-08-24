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

  it("repairs a legacy listening fallback that has text but no dialogue", async () => {
    const legacyPlan = structuredClone(plan);
    legacyPlan.aiBlueprint!.activities[0].status = "ready";
    legacyPlan.aiBlueprint!.activities[0].generatedContent = { text: "old generic fallback" };
    const service = new AiActivityGenerationService(
      { saveAiBlueprint: async (_plan: DailyPlan, blueprint: any) => ({ ...legacyPlan, aiBlueprint: blueprint }) } as any,
      { generateBlueprintActivity: async () => { throw new Error("fallback expected"); } } as any,
    );

    const result = await service.getOrGenerate(legacyPlan, "listening-1");
    expect((result.activity.generatedContent as any).dialogue).toHaveLength(3);
    expect((result.activity.generatedContent as any).questions).toHaveLength(2);
  });

  it("repairs a legacy conversation fallback with a usable coach opening", async () => {
    const conversationPlan = structuredClone(plan);
    conversationPlan.aiBlueprint!.activities[0] = {
      ...conversationPlan.aiBlueprint!.activities[0], id: "conversation-1", module: "conversation", status: "ready", generatedContent: { text: "Practice guided practice in this situation." },
    };
    const service = new AiActivityGenerationService(
      { saveAiBlueprint: async (_plan: DailyPlan, blueprint: any) => ({ ...conversationPlan, aiBlueprint: blueprint }) } as any,
      { generateBlueprintActivity: async () => { throw new Error("fallback expected"); } } as any,
    );

    const result = await service.getOrGenerate(conversationPlan, "conversation-1");
    expect((result.activity.generatedContent as any).openingMessage).toContain("What are you working on today?");
  });
});
