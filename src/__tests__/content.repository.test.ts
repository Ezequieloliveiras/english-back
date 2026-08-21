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
  it("keeps completed vocabulary out of the new bucket while unseen items exist", () => {
    const repository = new ContentRepository();
    const result = repository.personalizeForPlan({
      vocabulary: [
        { id: "vocabulary-a", phrase: "Where is the bathroom?", translation: "", level: "A1", category: "travel", sentences: [], confidence: 50, nextReviewAt: "2026-01-01", hits: 1, misses: 0 },
        { id: "vocabulary-b", phrase: "I need a reservation.", translation: "", level: "A1", category: "travel", sentences: [], confidence: 50, nextReviewAt: "2026-01-01", hits: 0, misses: 0 },
      ], listeningLessons: [], shadowingItems: [], conversationModes: [], developerModes: [], thinkInEnglishPrompts: [],
    }, buildProfile("Travel"), dailyPlan, {
      completedActivities: [{ type: "vocabulary", itemId: "vocabulary-a", title: "  where is the bathroom ? ", completedAt: "2026-07-01T10:00:00.000Z" }],
    });

    const oldItem = result.vocabulary.find((item) => item.id === "vocabulary-a");
    const newItem = result.vocabulary.find((item) => item.id === "vocabulary-b");
    expect(newItem?.contentMode).toBe("new");
    expect(oldItem?.contentMode).toBe("fallback");
    expect(result.vocabulary.indexOf(newItem!)).toBeLessThan(result.vocabulary.indexOf(oldItem!));
  });

  it("marks a due vocabulary item as review instead of new", () => {
    const repository = new ContentRepository();
    const vocabulary = { id: "vocabulary-a", phrase: "Where is the bathroom?", translation: "", level: "A1" as const, category: "travel", sentences: [], confidence: 50, nextReviewAt: "2026-01-01", hits: 1, misses: 0 };
    const result = repository.personalizeForPlan({ vocabulary: [vocabulary], listeningLessons: [], shadowingItems: [], conversationModes: [], developerModes: [], thinkInEnglishPrompts: [] }, buildProfile("Travel"), dailyPlan, {
      completedActivities: [{ type: "vocabulary", itemId: "vocabulary-a", title: vocabulary.phrase, completedAt: "2026-06-01T10:00:00.000Z" }],
      dueReviewItems: [vocabulary],
    });
    expect(result.vocabulary.find((item) => item.phrase === vocabulary.phrase)?.contentMode).toBe("review");
  });

  it("prioritizes unseen listening over a lesson with a poor prior attempt", () => {
    const repository = new ContentRepository();
    const lessonA = { id: "listening-a", title: "At the coffee shop", level: "A1" as const, dialogue: ["A: Where is the coffee shop?"], questions: [] };
    const lessonB = { id: "listening-b", title: "At the station", level: "A1" as const, dialogue: ["A: Which platform is it?"], questions: [] };
    const result = repository.personalizeForPlan({ vocabulary: [], listeningLessons: [lessonA, lessonB], shadowingItems: [], conversationModes: [], developerModes: [], thinkInEnglishPrompts: [] }, buildProfile("Travel"), dailyPlan, {
      completedActivities: [{ type: "listening", itemId: "listening-a", title: lessonA.title, completedAt: "2026-06-01T10:00:00.000Z" }],
      listeningAttempts: [{ exerciseId: "listening-a", expectedText: lessonA.dialogue[0], comprehensionCorrect: false, replayCount: 4, completedAt: "2026-06-01T10:00:00.000Z" }],
    });
    const a = result.listeningLessons.find((item) => item.id === "listening-a");
    const b = result.listeningLessons.find((item) => item.id === "listening-b");
    expect(a?.contentMode).toBe("reinforcement");
    expect(b?.contentMode).toBe("new");
    expect(result.listeningLessons.indexOf(b!)).toBeLessThan(result.listeningLessons.indexOf(a!));
  });

  it("uses the oldest completed vocabulary first when fallback is unavoidable", () => {
    const repository = new ContentRepository();
    const old = { id: "old", phrase: "I need a ticket.", translation: "", level: "A1" as const, category: "travel", sentences: [], confidence: 50, nextReviewAt: "2026-01-01", hits: 1, misses: 0 };
    const recent = { ...old, id: "recent", phrase: "I need a map." };
    const result = repository.personalizeForPlan({ vocabulary: [old, recent], listeningLessons: [], shadowingItems: [], conversationModes: [], developerModes: [], thinkInEnglishPrompts: [] }, buildProfile("Travel"), dailyPlan, {
      completedActivities: [
        { type: "vocabulary", itemId: old.id, title: old.phrase, completedAt: "2026-05-01T10:00:00.000Z" },
        { type: "vocabulary", itemId: recent.id, title: recent.phrase, completedAt: "2026-07-12T10:00:00.000Z" },
      ],
    });
    const oldItem = result.vocabulary.find((item) => item.phrase === old.phrase)!;
    const recentItem = result.vocabulary.find((item) => item.phrase === recent.phrase)!;
    expect(oldItem.contentMode).toBe("fallback");
    expect(recentItem.contentMode).toBe("fallback");
    expect(result.vocabulary.indexOf(oldItem)).toBeLessThan(result.vocabulary.indexOf(recentItem));
  });
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
      { ...firstRotationDailyPlan, date: "2026-01-03" }
    );

    const generatedLesson = result.listeningLessons[0];
    const generatedShadowing = result.shadowingItems.find((item) => item.semantic);
    const comprehension = generatedLesson.comprehension ?? [];

    expect(generatedLesson.semantic?.topic).toBeTruthy();
    expect(generatedLesson.dialogue.join(" ")).not.toMatch(/falar|reuniões|entrevistas/i);
    expect(comprehension[1].translationPtBr).toBeTruthy();
    expect(generatedShadowing?.semantic?.scenario).toBeTruthy();
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
      { ...firstRotationDailyPlan, date: "2026-01-03" }
    );

    const generatedShadowing = result.shadowingItems.find((item) => item.semantic);

    expect(generatedShadowing?.semantic?.topic).toBeTruthy();
    expect(generatedShadowing?.translation).not.toMatch(/undefined/i);
    expect(generatedShadowing?.explanation).toContain("Contexto:");
    expect(generatedShadowing?.pronunciationTip).toBeTruthy();
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

    const result = repository.personalizeForPlan(content, profile, { ...firstRotationDailyPlan, date: "2026-01-03" });
    const listeningTranslations = result.listeningLessons[0].comprehension?.map((item) => item.translationPtBr) ?? [];
    const allVocabularyTranslations = result.vocabulary.flatMap((item) => [
      item.translation,
      ...(item.sentences ?? []).map((sentence) => sentence.translation),
    ]);

    expect(listeningTranslations.every(Boolean)).toBe(true);
    expect([...listeningTranslations, ...allVocabularyTranslations].join(" ")).not.toMatch(
      /Eu consigo dizer|É assim que se diz|I can explain the issue and suggest a solution|Preciso esclarecer bug|Preciso confirmar bug/i
    );
    expect(allVocabularyTranslations).toContain("Preciso esclarecer problema primeiro.");
    expect(allVocabularyTranslations).toContain("Preciso confirmar problema.");
  });

  it("adds genuinely different progression language when the user moves from A2 to B1", () => {
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

    const a2Content = repository.personalizeForPlan(content, { ...profile, currentLevel: "A2" }, firstRotationDailyPlan);
    const b1Content = repository.personalizeForPlan(content, { ...profile, currentLevel: "B1" }, firstRotationDailyPlan);

    expect(a2Content.vocabulary.map((item) => item.phrase).join(" ")).toContain("I practiced this before");
    expect(a2Content.thinkInEnglishPrompts[0].coachReply).toContain("I practiced this before");
    expect(b1Content.vocabulary.map((item) => item.phrase).join(" ")).toContain("If the bug changes");
    expect(b1Content.thinkInEnglishPrompts[0].semantic?.communicativeGoal).toBeTruthy();
  });

  it("changes the generated listening focus across different study dates", () => {
    const repository = new ContentRepository();
    const content = {
      vocabulary: [],
      listeningLessons: [],
      shadowingItems: [],
      conversationModes: [],
      developerModes: [],
      thinkInEnglishPrompts: [],
    };
    const profile = buildProfile("Falar melhor no trabalho", { currentLevel: "A2" });

    const firstDay = repository.personalizeForPlan(content, profile, { ...dailyPlan, date: "2026-01-01" });
    const secondDay = repository.personalizeForPlan(content, profile, { ...dailyPlan, date: "2026-01-02" });

    expect(firstDay.listeningLessons[0].id).not.toBe(secondDay.listeningLessons[0].id);
    expect(firstDay.listeningLessons[0].title).not.toBe(secondDay.listeningLessons[0].title);
  });

  it("uses teacher memory to prioritize due review and repair weak words", () => {
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
      currentLevel: "A2",
      profession: "Developer",
      professionalFocusMode: "profession",
      professionValidationStatus: "verified",
    });

    const result = repository.personalizeForPlan(content, profile, dailyPlan, {
      completedActivities: [
        {
          type: "shadowing",
          itemId: "shadowing-old",
          title: "I need to check the API response before I continue.",
          completedAt: "2026-07-12T10:00:00.000Z",
        },
      ],
      listeningAttempts: [
        {
          exerciseId: "listening-1",
          expectedText: "I am checking the deployment now.",
          comprehensionCorrect: false,
          translationOpened: true,
          replayCount: 4,
          unknownWords: ["deployment"],
          completedAt: "2026-07-12T11:00:00.000Z",
        },
      ],
      recentSpeakingAttempts: [
        {
          id: "attempt-1",
          expectedText: "I will update the team after I check the deployment.",
          transcribedText: "I will update the team after I check deploy",
          pronunciationScore: 5,
          naturalnessScore: 6,
          connectedSpeechScore: 5,
          wordsSpokenCount: 9,
          correctedWords: ["deployment"],
          suggestion: "Practice the final syllable in deployment.",
          createdAt: "2026-07-12T12:00:00.000Z",
        },
      ],
      dueReviewItems: [
        {
          id: "review-1",
          phrase: "I need to check the API response before I continue.",
          translation: "Eu preciso verificar a resposta da API antes de continuar.",
          level: "A2",
          category: "Developer",
          sentences: [
            {
              text: "I need to check the API response before I continue.",
              translation: "Eu preciso verificar a resposta da API antes de continuar.",
            },
          ],
          confidence: 35,
          nextReviewAt: "2026-07-12T09:00:00.000Z",
          hits: 1,
          misses: 2,
          source: "user_saved",
        },
      ],
    });

    // Known material may still be present as reinforcement, but never jumps
    // ahead of genuinely new daily material.
    expect(result.vocabulary[0].contentMode).toBe("new");
    expect(result.vocabulary.map((item) => item.phrase)).toContain("I need to check the API response before I continue.");
    expect(result.vocabulary.map((item) => item.phrase).join(" ")).toContain(
      'I need to use "deployment" in a complete sentence.'
    );
    expect(result.thinkInEnglishPrompts[0].coachReply).toContain("review I need to check the API response");
    expect(result.listeningLessons[0].dialogue.join(" ")).toContain("We practiced");
  });
});
