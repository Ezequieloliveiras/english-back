import mongoose from "mongoose";
import { dashboardSeed } from "../data/seedData";
import { ContentCatalogModel } from "../models/contentCatalog.model";
import { ReviewScheduleModel } from "../models/reviewSchedule.model";
import { VocabularyItemModel } from "../models/vocabularyItem.model";
import {
  ConversationMode,
  DailyPlan,
  ListeningLesson,
  ShadowingItem,
  StudyBlockType,
  ThinkInEnglishPrompt,
  UserProfile,
  VocabularyItem,
} from "../types";

type LearningContent = {
  vocabulary: VocabularyItem[];
  listeningLessons: ListeningLesson[];
  shadowingItems: ShadowingItem[];
  conversationModes: ConversationMode[];
  developerModes: ConversationMode[];
  thinkInEnglishPrompts: ThinkInEnglishPrompt[];
};

type PlanScenario = {
  title: string;
  situation: string;
  dialogue: string[];
  translations: string[];
  questions: Array<{ prompt: string; answer: string }>;
};

const planBlockOrder: StudyBlockType[] = [
  "shadowing",
  "speaking-coach",
  "listening",
  "vocabulary",
  "conversation",
  "review",
];

const rotateItems = <T>(items: T[], rotation: number) => {
  if (!items.length) {
    return items;
  }

  const index = Math.abs(rotation) % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
};

const uniqueBy = <T>(items: T[], getKey: (item: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const getPlanRotation = (dailyPlan: DailyPlan) => {
  const firstType = dailyPlan.blocks[0]?.type;
  const index = firstType ? planBlockOrder.indexOf(firstType) : 0;
  return index >= 0 ? index : 0;
};

const safeText = (value: string, fallback: string) => value.trim().replace(/\s+/g, " ") || fallback;

const buildPlanScenario = (user: UserProfile, dailyPlan: DailyPlan) => {
  const rotation = getPlanRotation(dailyPlan);
  const profession = safeText(user.profession, "your work");
  const goal = safeText(user.primaryGoal, "speak with more confidence");
  const scenarios: PlanScenario[] = [
    {
      title: "Planning the Next Task",
      situation: `A short work conversation about priorities in ${profession}.`,
      dialogue: [
        "Manager: What is your main focus for this session?",
        `Student: I want to practice English for ${goal}.`,
        "Manager: Good. What is one small task you can finish now?",
        "Student: I can explain my next step in simple English.",
      ],
      translations: [
        "Qual e o seu foco principal nesta sessao?",
        `Eu quero praticar ingles para ${goal}.`,
        "Certo. Qual e uma pequena tarefa que voce consegue terminar agora?",
        "Eu consigo explicar meu proximo passo em ingles simples.",
      ],
      questions: [
        { prompt: "What does the student want to practice?", answer: goal },
        { prompt: "What can the student explain?", answer: "The next step in simple English." },
      ],
    },
    {
      title: "Explaining a Blocker",
      situation: "A teammate asks for a clear update about a blocker.",
      dialogue: [
        "Teammate: Are you blocked on anything right now?",
        "Student: Yes, I need more context before I continue.",
        "Teammate: What context do you need?",
        `Student: I need the goal and the expected result for this ${profession} task.`,
      ],
      translations: [
        "Voce esta bloqueado em alguma coisa agora?",
        "Sim, eu preciso de mais contexto antes de continuar.",
        "De que contexto voce precisa?",
        `Eu preciso do objetivo e do resultado esperado para esta tarefa de ${profession}.`,
      ],
      questions: [
        { prompt: "What does the student need?", answer: "More context." },
        { prompt: "What result does the student need?", answer: "The expected result." },
      ],
    },
    {
      title: "Reviewing Progress",
      situation: "A quick review of what was practiced and what comes next.",
      dialogue: [
        "Coach: What did you practice in this cycle?",
        "Student: I practiced short answers and useful work phrases.",
        "Coach: What should you do next?",
        "Student: I should repeat the strongest phrases out loud.",
      ],
      translations: [
        "O que voce praticou neste ciclo?",
        "Eu pratiquei respostas curtas e frases uteis de trabalho.",
        "O que voce deve fazer agora?",
        "Eu devo repetir as frases mais fortes em voz alta.",
      ],
      questions: [
        { prompt: "What did the student practice?", answer: "Short answers and useful work phrases." },
        { prompt: "What should the student repeat?", answer: "The strongest phrases." },
      ],
    },
    {
      title: "Asking for Clarification",
      situation: "A practical exchange for understanding instructions.",
      dialogue: [
        "Lead: Can you handle this today?",
        "Student: I can, but I need to confirm one detail first.",
        "Lead: Sure. What do you want to confirm?",
        "Student: I want to confirm the priority and the deadline.",
      ],
      translations: [
        "Voce consegue cuidar disso hoje?",
        "Eu consigo, mas preciso confirmar um detalhe primeiro.",
        "Claro. O que voce quer confirmar?",
        "Eu quero confirmar a prioridade e o prazo.",
      ],
      questions: [
        { prompt: "Can the student handle the task?", answer: "Yes, after confirming one detail." },
        { prompt: "What does the student confirm?", answer: "The priority and the deadline." },
      ],
    },
  ];

  return scenarios[rotation % scenarios.length];
};

const chunkByPhrase = (text: string, translation: string) => {
  const words = text.replace(/[?.!]/g, "").split(/\s+/).filter(Boolean);

  if (words.length <= 4) {
    return [{ text, meaning: translation }];
  }

  const middle = Math.ceil(words.length / 2);
  return [
    { text: words.slice(0, middle).join(" "), meaning: translation },
    { text: words.slice(middle).join(" "), meaning: "parte final da ideia" },
  ];
};

const buildPlanListeningLesson = (user: UserProfile, dailyPlan: DailyPlan): ListeningLesson => {
  const rotation = getPlanRotation(dailyPlan);
  const scenario = buildPlanScenario(user, dailyPlan);

  return {
    id: `plan-listening-${dailyPlan.date}-${rotation}`,
    title: scenario.title,
    level: user.currentLevel,
    situationDescription: scenario.situation,
    dialogue: scenario.dialogue,
    questions: scenario.questions.map((question, index) => ({
      id: `plan-question-${dailyPlan.date}-${rotation}-${index + 1}`,
      ...question,
    })),
    comprehension: scenario.dialogue.map((line, index) => {
      const text = line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line;
      const translation = scenario.translations[index] ?? "Traducao em portugues indisponivel.";

      return {
        sourceText: text,
        naturalTranslation: translation,
        translationPtBr: translation,
        context: "Use esta frase como parte do ciclo atual de estudo.",
        chunks: chunkByPhrase(text, translation),
        pronunciationTip: "Mantenha a frase curta, clara e conectada.",
      };
    }),
  };
};

const buildPlanShadowingItems = (user: UserProfile, dailyPlan: DailyPlan): ShadowingItem[] => {
  const rotation = getPlanRotation(dailyPlan);
  const goal = safeText(user.primaryGoal, "speak with more confidence");
  const profession = safeText(user.profession, "work");
  const sets: ShadowingItem[][] = [
    [
      {
        id: `plan-shadowing-${dailyPlan.date}-${rotation}-1`,
        phrase: "I can explain the next step in simple English.",
        naturalTranslation: "Eu consigo explicar o proximo passo em ingles simples.",
        pronunciationHint: "Stress 'next step' and keep the ending clear.",
        context: `Use this for ${profession} updates.`,
        chunks: [
          { text: "I can explain", meaning: "Eu consigo explicar" },
          { text: "the next step", meaning: "o proximo passo" },
          { text: "in simple English", meaning: "em ingles simples" },
        ],
      },
      {
        id: `plan-shadowing-${dailyPlan.date}-${rotation}-2`,
        phrase: `My goal today is to practice: ${goal}.`,
        naturalTranslation: `Meu objetivo hoje e praticar: ${goal}.`,
        pronunciationHint: "Pause briefly after 'today' and finish with confidence.",
        chunks: [
          { text: "My goal today", meaning: "Meu objetivo hoje" },
          { text: "is to practice", meaning: "e praticar" },
        ],
      },
    ],
    [
      {
        id: `plan-shadowing-${dailyPlan.date}-${rotation}-1`,
        phrase: "I need to confirm the priority before I continue.",
        naturalTranslation: "Eu preciso confirmar a prioridade antes de continuar.",
        pronunciationHint: "Connect 'need to' naturally, close to 'needta'.",
        chunks: [
          { text: "I need to confirm", meaning: "Eu preciso confirmar" },
          { text: "the priority", meaning: "a prioridade" },
          { text: "before I continue", meaning: "antes de continuar" },
        ],
      },
      {
        id: `plan-shadowing-${dailyPlan.date}-${rotation}-2`,
        phrase: "Could you give me one example, please?",
        naturalTranslation: "Voce poderia me dar um exemplo, por favor?",
        pronunciationHint: "Reduce 'could you' and stress 'one example'.",
        chunks: [
          { text: "Could you give me", meaning: "Voce poderia me dar" },
          { text: "one example", meaning: "um exemplo" },
          { text: "please", meaning: "por favor" },
        ],
      },
    ],
  ];

  return sets[rotation % sets.length];
};

const buildPlanVocabulary = (user: UserProfile, dailyPlan: DailyPlan): VocabularyItem[] => {
  const rotation = getPlanRotation(dailyPlan);
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + 2);

  return [
    {
      id: `plan-vocab-${dailyPlan.date}-${rotation}-1`,
      phrase: "I need to confirm one detail first.",
      translation: "Preciso confirmar um detalhe primeiro.",
      level: user.currentLevel,
      category: "Current plan",
      sentences: [
        { text: "I need to confirm one detail first.", translation: "Preciso confirmar um detalhe primeiro." },
        { text: "I need to confirm the priority.", translation: "Preciso confirmar a prioridade." },
        { text: "I need to confirm the deadline.", translation: "Preciso confirmar o prazo." },
      ],
      confidence: 50,
      nextReviewAt: nextReview.toISOString(),
      hits: 0,
      misses: 0,
      source: "plan_generated",
      timesPracticed: 0,
      timesCorrect: 0,
      timesWrong: 0,
    },
    {
      id: `plan-vocab-${dailyPlan.date}-${rotation}-2`,
      phrase: "I can explain my next step clearly.",
      translation: "Eu consigo explicar meu proximo passo com clareza.",
      level: user.currentLevel,
      category: "Current plan",
      sentences: [
        { text: "I can explain my next step clearly.", translation: "Eu consigo explicar meu proximo passo com clareza." },
        { text: "I can explain the blocker clearly.", translation: "Eu consigo explicar o bloqueio com clareza." },
        { text: "I can explain the expected result clearly.", translation: "Eu consigo explicar o resultado esperado com clareza." },
      ],
      confidence: 50,
      nextReviewAt: nextReview.toISOString(),
      hits: 0,
      misses: 0,
      source: "plan_generated",
      timesPracticed: 0,
      timesCorrect: 0,
      timesWrong: 0,
    },
  ];
};

const buildPlanThinkPrompt = (dailyPlan: DailyPlan): ThinkInEnglishPrompt => ({
  id: `plan-think-${dailyPlan.date}-${getPlanRotation(dailyPlan)}`,
  userMessage: "Quero falar sobre meu plano de estudo de hoje.",
  coachReply: "Start in English with one short sentence: Today, I want to practice...",
});

const toPlainVocabulary = (item: any): VocabularyItem => ({
  id: String(item._id ?? item.id),
  phrase: item.phrase,
  translation: item.translation,
  level: item.level,
  category: item.category,
  sentences: item.sentences,
  confidence: item.confidence,
  nextReviewAt: item.nextReviewAt instanceof Date ? item.nextReviewAt.toISOString() : item.nextReviewAt,
  hits: item.hits,
  misses: item.misses,
  source: item.source ?? "user_saved",
  timesPracticed: item.timesPracticed ?? item.hits + item.misses,
  timesCorrect: item.timesCorrect ?? item.hits,
  timesWrong: item.timesWrong ?? item.misses,
});

const hydrateListeningLessons = (lessons: ListeningLesson[] = []) => {
  const seedById = new Map(dashboardSeed.listeningLessons.map((lesson) => [lesson.id, lesson]));

  return lessons.map((lesson) => {
    const seedLesson = seedById.get(lesson.id);

    if (!seedLesson) {
      return lesson;
    }

    return {
      ...seedLesson,
      ...lesson,
      imageUrl: lesson.imageUrl ?? seedLesson.imageUrl,
      imageSource: lesson.imageSource ?? seedLesson.imageSource,
      imageAlt: lesson.imageAlt ?? seedLesson.imageAlt,
      situationDescription: lesson.situationDescription ?? seedLesson.situationDescription,
      comprehension: lesson.comprehension?.length ? lesson.comprehension : seedLesson.comprehension,
    };
  });
};

export class ContentRepository {
  private async seedCatalogIfNeeded() {
    const [vocabularyCount, catalogCount] = await Promise.all([
      VocabularyItemModel.countDocuments(),
      ContentCatalogModel.countDocuments(),
    ]);

    if (vocabularyCount === 0) {
      await VocabularyItemModel.insertMany(
        dashboardSeed.vocabulary.map((item) => ({
          phrase: item.phrase,
          translation: item.translation,
          level: item.level,
          category: item.category,
          sentences: item.sentences,
          confidence: item.confidence,
          nextReviewAt: new Date(item.nextReviewAt),
          hits: item.hits,
          misses: item.misses,
        }))
      );
    }

    if (catalogCount === 0) {
      await ContentCatalogModel.insertMany([
        { key: "listeningLessons", items: dashboardSeed.listeningLessons },
        { key: "shadowingItems", items: dashboardSeed.shadowingItems },
        { key: "conversationModes", items: dashboardSeed.conversationModes },
        { key: "developerModes", items: dashboardSeed.developerModes },
        { key: "thinkInEnglishPrompts", items: dashboardSeed.thinkInEnglishPrompts },
      ]);
    }
  }

  async getLearningContent(userId: string): Promise<LearningContent> {
    await this.seedCatalogIfNeeded();

    const [vocabulary, catalogs] = await Promise.all([
      VocabularyItemModel.find({ userId }).sort({ createdAt: -1 }),
      ContentCatalogModel.find(),
    ]);
    const byKey = new Map(catalogs.map((catalog) => [catalog.key, catalog.items]));

    return {
      vocabulary: vocabulary.map(toPlainVocabulary),
      listeningLessons: hydrateListeningLessons(byKey.get("listeningLessons") ?? dashboardSeed.listeningLessons),
      shadowingItems: byKey.get("shadowingItems") ?? [],
      conversationModes: byKey.get("conversationModes") ?? [],
      developerModes: byKey.get("developerModes") ?? [],
      thinkInEnglishPrompts: byKey.get("thinkInEnglishPrompts") ?? [],
    };
  }

  personalizeForPlan(content: LearningContent, user: UserProfile, dailyPlan: DailyPlan): LearningContent {
    const rotation = getPlanRotation(dailyPlan);

    return {
      vocabulary: uniqueBy(
        [
          ...buildPlanVocabulary(user, dailyPlan),
          ...rotateItems(content.vocabulary, rotation),
        ],
        (item) => item.phrase
      ),
      listeningLessons: uniqueBy(
        [
          buildPlanListeningLesson(user, dailyPlan),
          ...rotateItems(content.listeningLessons, rotation),
        ],
        (item) => item.id
      ),
      shadowingItems: uniqueBy(
        [
          ...buildPlanShadowingItems(user, dailyPlan),
          ...rotateItems(content.shadowingItems, rotation),
        ],
        (item) => item.phrase
      ),
      conversationModes: rotateItems(content.conversationModes, rotation),
      developerModes: rotateItems(content.developerModes, rotation),
      thinkInEnglishPrompts: [
        buildPlanThinkPrompt(dailyPlan),
        ...rotateItems(content.thinkInEnglishPrompts, rotation),
      ],
    };
  }

  async getDueReviewItems(userId: string) {
    const now = new Date();
    const schedules = await ReviewScheduleModel.find({
      userId,
      nextReviewAt: { $lte: now },
    })
      .sort({ nextReviewAt: 1 })
      .populate("vocabularyItemId");

    return schedules
      .map((schedule) => schedule.vocabularyItemId)
      .filter(Boolean)
      .map(toPlainVocabulary);
  }

  async recordVocabularyReview(userId: string, item: VocabularyItem, review: Partial<VocabularyItem>) {
    const next = {
      confidence: review.confidence ?? item.confidence,
      nextReviewAt: review.nextReviewAt ?? item.nextReviewAt,
      hits: review.hits ?? item.hits,
      misses: review.misses ?? item.misses,
    };
    const timesPracticed = next.hits + next.misses;

    if (mongoose.connection.readyState !== 1) {
      return {
        ...item,
        ...next,
        timesPracticed,
        timesCorrect: next.hits,
        timesWrong: next.misses,
      };
    }

    const update = {
      $setOnInsert: {
        userId,
        phrase: item.phrase,
        translation: item.translation,
        level: item.level,
        category: item.category,
        sentences: item.sentences,
        source: item.source ?? "user_saved",
      },
      $set: {
        confidence: next.confidence,
        nextReviewAt: new Date(next.nextReviewAt),
        hits: next.hits,
        misses: next.misses,
        timesPracticed,
        timesCorrect: next.hits,
        timesWrong: next.misses,
      },
    };

    const saved = mongoose.Types.ObjectId.isValid(item.id)
      ? await VocabularyItemModel.findByIdAndUpdate(item.id, update, { new: true })
      : await VocabularyItemModel.findOneAndUpdate(
          { userId, phrase: item.phrase },
          update,
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

    if (!saved) {
      return null;
    }

    await ReviewScheduleModel.findOneAndUpdate(
      { userId, vocabularyItemId: saved._id },
      {
        $set: {
          hits: saved.hits,
          misses: saved.misses,
          confidence: saved.confidence,
          nextReviewAt: saved.nextReviewAt,
        },
      },
      { new: true, upsert: true }
    );

    return toPlainVocabulary(saved);
  }

  async updateVocabularyReview(userId: string, itemId: string, review: Partial<VocabularyItem>) {
    const item = await VocabularyItemModel.findByIdAndUpdate(
      itemId,
      {
        $set: {
          userId,
          ...(review.confidence !== undefined ? { confidence: review.confidence } : {}),
          ...(review.nextReviewAt ? { nextReviewAt: new Date(review.nextReviewAt) } : {}),
          ...(review.hits !== undefined ? { hits: review.hits } : {}),
          ...(review.misses !== undefined ? { misses: review.misses } : {}),
          ...(review.hits !== undefined ? { timesCorrect: review.hits } : {}),
          ...(review.misses !== undefined ? { timesWrong: review.misses } : {}),
          timesPracticed: (review.hits ?? 0) + (review.misses ?? 0),
        },
      },
      { new: true }
    );

    if (!item) {
      return null;
    }

    await ReviewScheduleModel.findOneAndUpdate(
      { userId, vocabularyItemId: item._id },
      {
        $set: {
          hits: item.hits,
          misses: item.misses,
          confidence: item.confidence,
          nextReviewAt: item.nextReviewAt,
        },
      },
      { new: true, upsert: true }
    );

    return toPlainVocabulary(item);
  }
}
