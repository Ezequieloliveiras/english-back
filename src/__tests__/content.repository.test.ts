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
const firstRotationDailyPlan = { ...dailyPlan, date: "2026-01-01" };

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
      firstRotationDailyPlan
    );

    const generatedLesson = result.listeningLessons[0];
    const generatedShadowing = result.shadowingItems.find((item) => item.text.includes("meetings and interviews"));
    const comprehension = generatedLesson.comprehension ?? [];

    expect(generatedLesson.dialogue.join(" ")).toContain("meetings and interviews");
    expect(generatedLesson.dialogue.join(" ")).not.toMatch(/falar|reuniões|entrevistas/i);
    expect(comprehension[1].translationPtBr).toContain("reuniões e entrevistas");
    expect(generatedShadowing?.text).toContain("meetings and interviews");
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
      firstRotationDailyPlan
    );

    const generatedShadowing = result.shadowingItems.find(
      (item) => item.text === "The layout should make the main action clearer."
    );

    expect(generatedShadowing?.text).toBe("The layout should make the main action clearer.");
    expect(generatedShadowing?.translation).toBe("O leiaute deve deixar a ação principal mais clara.");
    expect(generatedShadowing?.explanation).toBe("Use em atualizações de design.");
    expect(generatedShadowing?.pronunciationTip).toBe(
      "Destaque o termo profissional principal e mantenha o final claro."
    );
  });

  it("prioritizes new shadowing phrases over recently completed phrases", () => {
    const repository = new ContentRepository();
    const content = {
      vocabulary: [],
      listeningLessons: [],
      shadowingItems: [],
      conversationModes: [],
      developerModes: [],
      thinkInEnglishPrompts: [],
    };
    const profile = buildProfile("Falar melhor no trabalho", {
      profession: "Developer",
      professionalFocusMode: "profession",
      professionValidationStatus: "verified",
    });
    const firstPlan = repository.personalizeForPlan(content, profile, dailyPlan);
    const completed = firstPlan.shadowingItems.slice(0, 2).map((item, index) => ({
      id: `activity-${index}`,
      type: "shadowing",
      itemId: item.id,
      title: item.text,
      completedAt: new Date(Date.now() - index * 1000).toISOString(),
    }));
    const nextPlan = repository.personalizeForPlan(content, profile, dailyPlan, {
      completedActivities: completed,
    });
    const repeatedRecently = nextPlan.shadowingItems.filter((item) =>
      completed.some((activity) => activity.title === item.text)
    );

    expect(repeatedRecently).toHaveLength(0);
    expect(nextPlan.shadowingItems.length).toBeGreaterThanOrEqual(3);
  });

  it("uses real Portuguese translations in generated listening and vocabulary content", () => {
    const repository = new ContentRepository();
    const content = {
      vocabulary: [],
      listeningLessons: [],
      shadowingItems: [],
      conversationModes: [],
      developerModes: [],
      thinkInEnglishPrompts: [],
    };
    const profile = buildProfile("Falar melhor no trabalho", {
      profession: "Developer",
      professionalFocusMode: "profession",
      professionValidationStatus: "verified",
    });

    const result = repository.personalizeForPlan(content, profile, firstRotationDailyPlan);
    const listeningTranslations = result.listeningLessons[0].comprehension?.map((item) => item.translationPtBr) ?? [];
    const allVocabularyTranslations = result.vocabulary.flatMap((item) => [
      item.translation,
      ...(item.sentences ?? []).map((sentence) => sentence.translation),
    ]);

    expect(listeningTranslations).toContain("Eu consigo explicar o problema e sugerir uma solução.");
    expect([...listeningTranslations, ...allVocabularyTranslations].join(" ")).not.toMatch(
      /Eu consigo dizer|É assim que se diz|I can explain the issue and suggest a solution|Preciso esclarecer bug|Preciso confirmar bug/i
    );
    expect(allVocabularyTranslations).toContain("Preciso esclarecer problema primeiro.");
    expect(allVocabularyTranslations).toContain("Preciso confirmar problema.");
  });
});
