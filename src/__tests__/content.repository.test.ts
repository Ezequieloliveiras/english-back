import { describe, expect, it } from "@jest/globals";
import { ContentRepository } from "../repositories/content.repository";
import { DailyPlan, UserProfile } from "../types";

const buildProfile = (primaryGoal: string, overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  currentLevel: "A1",
  dailyMinutes: 20,
  profession: "Marketing",
  professionalFocusMode: "standard",
  professionValidationStatus: "unchecked",
  primaryGoal,
  mainDifficulty: "speaking",
  initialSetupCompleted: true,
  ...overrides,
});

const dailyPlan: DailyPlan = {
  id: "plan-1",
  userId: "user-1",
  focus: "Today focus",
  totalMinutes: 20,
  streak: 0,
  date: "2026-07-13",
  blocks: [
    {
      id: "block-1",
      title: "Shadowing",
      type: "shadowing",
      durationMinutes: 5,
      status: "not_started",
      progress: 0,
      objective: "Practice useful phrases.",
    },
  ],
};

describe("ContentRepository.personalizeForPlan", () => {
  it("keeps generated English dialogue in English when the user goal is Portuguese", () => {
    const repository = new ContentRepository();
    const content = {
      vocabulary: [],
      listeningLessons: [],
      shadowingItems: [],
      conversationModes: [],
      developerModes: [],
      thinkInEnglishPrompts: [],
    };

    const result = repository.personalizeForPlan(
      content,
      buildProfile("Falar em reuniões e entrevistas"),
      dailyPlan
    );

    const generatedLesson = result.listeningLessons[0];
    const generatedShadowing = result.shadowingItems[1];
    const comprehension = generatedLesson.comprehension ?? [];

    expect(generatedLesson.dialogue.join(" ")).toContain("meetings and interviews");
    expect(generatedLesson.dialogue.join(" ")).not.toMatch(/falar|reuniões|entrevistas/i);
    expect(comprehension[1].translationPtBr).toContain("reuniões e entrevistas");
    expect(generatedShadowing.phrase).toContain("meetings and interviews");
  });

  it("keeps shadowing support copy in Portuguese while the practice phrase stays English", () => {
    const repository = new ContentRepository();
    const content = {
      vocabulary: [],
      listeningLessons: [],
      shadowingItems: [],
      conversationModes: [],
      developerModes: [],
      thinkInEnglishPrompts: [],
    };

    const result = repository.personalizeForPlan(
      content,
      buildProfile("Falar melhor no trabalho", {
        profession: "Designer",
        professionalFocusMode: "profession",
        professionValidationStatus: "verified",
      }),
      dailyPlan
    );

    const generatedShadowing = result.shadowingItems[0];

    expect(generatedShadowing.phrase).toBe("The layout should make the main action clearer.");
    expect(generatedShadowing.naturalTranslation).toBe("O layout deve deixar a ação principal mais clara.");
    expect(generatedShadowing.context).toBe("Use em atualizações de design.");
    expect(generatedShadowing.pronunciationHint).toBe(
      "Destaque o termo profissional principal e mantenha o final claro."
    );
  });
});
