import mongoose from "mongoose";
import { dashboardSeed } from "../data/seedData";
import { ContentCatalogModel } from "../models/contentCatalog.model";
import { ContentExposureModel } from "../models/contentExposure.model";
import { ReviewScheduleModel } from "../models/reviewSchedule.model";
import { VocabularyItemModel } from "../models/vocabularyItem.model";
import {
  ConversationMode,
  ContentMode,
  ContentSemanticMetadata,
  DailyPlan,
  EnglishLevel,
  ListeningLesson,
  ShadowingItem,
  StudyBlockType,
  ThinkInEnglishPrompt,
  UserProfile,
  VocabularyItem,
} from "../types";
import { DailyContentModule, SemanticContext, selectSemanticContext, semanticFingerprint } from "../services/contentDiversity.service";
import { normalizeShadowingItem } from "../utils/trainingPhrase";

type LearningContent = {
  vocabulary: VocabularyItem[];
  listeningLessons: ListeningLesson[];
  shadowingItems: ShadowingItem[];
  conversationModes: ConversationMode[];
  developerModes: ConversationMode[];
  thinkInEnglishPrompts: ThinkInEnglishPrompt[];
};

type CompletedActivitySummary = {
  type: string;
  itemId: string;
  title: string;
  completedAt: string;
  semantic?: ContentSemanticMetadata;
};

type ListeningAttemptSummary = {
  exerciseId: string;
  expectedText?: string;
  comprehensionCorrect?: boolean;
  translationOpened?: boolean;
  transcriptOpened?: boolean;
  slowAudioUsed?: boolean;
  replayCount?: number;
  unknownWords?: string[];
  completedAt: string;
};

type SpeakingAttemptSummary = {
  id?: string;
  expectedText: string;
  transcribedText: string;
  pronunciationScore: number;
  naturalnessScore?: number;
  connectedSpeechScore: number;
  wordsSpokenCount: number;
  correctedWords?: string[];
  suggestion?: string | null;
  createdAt?: string;
};

type PersonalizationHistory = {
  completedActivities?: CompletedActivitySummary[];
  listeningAttempts?: ListeningAttemptSummary[];
  recentSpeakingAttempts?: SpeakingAttemptSummary[];
  dueReviewItems?: VocabularyItem[];
  presentedContent?: CompletedActivitySummary[];
};

type TeacherMemory = {
  recentlyTaughtPhrases: string[];
  reviewPhrases: VocabularyItem[];
  weakWords: string[];
  correctionTargets: string[];
  supportSignals: string[];
  teacherFocus: string;
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

const normalizeContentKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const contentFingerprint = (type: string, text: string) =>
  `${type}:${normalizeContentKey(text)}`;

type EligibleItem<T> = {
  item: T;
  id: string;
  text: string;
  aliases?: string[];
};

type EligibilityHistory = PersonalizationHistory;

const normalizedActivityTypes = (type: string) => {
  if (type === "shadowing" || type === "repetition") return new Set(["shadowing", "repetition"]);
  if (type === "conversation") return new Set(["conversation", "think-in-english", "developer-mode"]);
  return new Set([type]);
};

/**
 * The single selection policy used by every daily-content catalog.  It never
 * treats a known item as new: new items come first, then pedagogical repeats,
 * then the oldest known content as a controlled fallback.
 */
const orderByEligibility = <T>(
  type: string,
  candidates: EligibleItem<T>[],
  history: EligibilityHistory,
  seed: number,
  options: { isReinforcement?: (candidate: EligibleItem<T>) => boolean } = {}
) => {
  const acceptedTypes = normalizedActivityTypes(type);
  const seen = [...(history.completedActivities ?? []), ...(history.presentedContent ?? [])]
    .filter((activity) => acceptedTypes.has(activity.type));
  const due = history.dueReviewItems ?? [];
  const listeningAttempts = history.listeningAttempts ?? [];
  const seenFor = (candidate: EligibleItem<T>) => {
    const keys = new Set([candidate.id, contentFingerprint(type, candidate.text), ...(candidate.aliases ?? [])]);
    return seen
      .filter((activity) => keys.has(activity.itemId) || keys.has(contentFingerprint(type, activity.title)))
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
  };
  const isDue = (candidate: EligibleItem<T>) =>
    type === "vocabulary" && due.some((item) =>
      item.id === candidate.id || normalizeContentKey(item.phrase) === normalizeContentKey(candidate.text)
    );
  const needsListeningReinforcement = (candidate: EligibleItem<T>) =>
    type === "listening" && listeningAttempts.some((attempt) => {
      const keys = new Set([candidate.id, ...candidate.aliases ?? []]);
      const attempted = normalizeContentKey(attempt.expectedText ?? "");
      return (
        keys.has(attempt.exerciseId) ||
        (attempted.length > 0 && candidate.aliases?.some((alias) => alias.endsWith(`:${attempted}`)))
      ) && (!attempt.comprehensionCorrect || (attempt.replayCount ?? 0) >= 3 || (attempt.unknownWords?.length ?? 0) > 0);
    });

  const groups: Record<ContentMode, Array<{ candidate: EligibleItem<T>; lastSeen?: string }>> = {
    new: [], review: [], reinforcement: [], fallback: [],
  };
  for (const candidate of candidates) {
    const previous = seenFor(candidate);
    const reinforcement = options.isReinforcement?.(candidate) || needsListeningReinforcement(candidate);
    if (!previous) groups.new.push({ candidate });
    else if (isDue(candidate)) groups.review.push({ candidate, lastSeen: previous.completedAt });
    else if (reinforcement) groups.reinforcement.push({ candidate, lastSeen: previous.completedAt });
    else groups.fallback.push({ candidate, lastSeen: previous.completedAt });
  }
  const rotateGroup = <V,>(items: V[]) => rotateItems(items, seed);
  const fallback = [...groups.fallback].sort((a, b) => {
    const aTime = Date.parse(a.lastSeen ?? "") || 0;
    const bTime = Date.parse(b.lastSeen ?? "") || 0;
    // Older content is a safer fallback than a recent completion.
    const recency = aTime - bTime;
    return recency || 0;
  });
  return [
    ...rotateGroup(groups.new).map(({ candidate }) => ({ ...candidate.item, contentMode: "new" as const })),
    ...rotateGroup(groups.review).map(({ candidate }) => ({ ...candidate.item, contentMode: "review" as const })),
    ...rotateGroup(groups.reinforcement).map(({ candidate }) => ({ ...candidate.item, contentMode: "reinforcement" as const })),
    ...fallback.map(({ candidate, lastSeen }) => ({
      ...candidate.item,
      contentMode: "fallback" as const,
      // Recent fallback remains last because fallback was sorted oldest-first.
      _lastSeen: lastSeen,
    })),
  ].map((entry) => {
    const item = entry as T & { contentMode: ContentMode; _lastSeen?: string };
    delete item._lastSeen;
    return item;
  });
};

const stableContentId = (prefix: string, text: string) => {
  let hash = 0;

  for (const character of normalizeContentKey(text)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return `${prefix}-${hash.toString(36)}`;
};

const numericDateSeed = (date: string) =>
  date.split("-").reduce((sum, part) => sum + Number(part), 0);

const levelOrder: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1"];

const normalizeLevel = (level: string): EnglishLevel => {
  const value = level.toUpperCase();

  return levelOrder.includes(value as EnglishLevel) ? (value as EnglishLevel) : "A1";
};

const levelRank = (level: EnglishLevel) => Math.max(0, levelOrder.indexOf(level));

const levelDistance = (target: EnglishLevel, candidate: EnglishLevel) =>
  Math.abs(levelRank(target) - levelRank(candidate));

const allowedReviewLevels = (level: EnglishLevel) => {
  const rank = levelRank(level);

  if (rank <= 0) {
    return new Set<EnglishLevel>(["A1"]);
  }

  return new Set<EnglishLevel>(levelOrder.slice(Math.max(0, rank - 1), rank + 1));
};

const learningStageCopy: Record<EnglishLevel, { focus: string; label: string }> = {
  A1: {
    label: "A1 foundation",
    focus: "today's core: short present-tense sentences, useful questions, and clear survival replies",
  },
  A2: {
    label: "A2 bridge",
    focus: "today's upgrade: past actions, future plans, polite requests, and short reasons with because",
  },
  B1: {
    label: "B1 expansion",
    focus: "today's upgrade: reasons, tradeoffs, conditionals, and follow-up questions in realistic conversations",
  },
  B2: {
    label: "B2 precision",
    focus: "today's upgrade: nuance, prioritization, disagreement, and clearer explanations under pressure",
  },
  C1: {
    label: "C1 polish",
    focus: "today's upgrade: concise argumentation, hedging, synthesis, and natural professional tone",
  },
};

const dailyProgressionSeed = (dailyPlan: DailyPlan, user: UserProfile) =>
  numericDateSeed(dailyPlan.date) + getPlanRotation(dailyPlan) + levelRank(normalizeLevel(user.currentLevel));

const buildTeacherMemory = (history: PersonalizationHistory = {}): TeacherMemory => {
  const completed = [...(history.completedActivities ?? [])].sort(
    (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)
  );
  const listening = [...(history.listeningAttempts ?? [])].sort(
    (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)
  );
  const speaking = [...(history.recentSpeakingAttempts ?? [])].sort(
    (a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "")
  );
  const dueReviewItems = history.dueReviewItems ?? [];
  const recentlyTaughtPhrases = uniqueNormalized([
    ...completed.map((activity) => activity.title),
    ...listening.map((attempt) => attempt.expectedText ?? ""),
    ...speaking.map((attempt) => attempt.expectedText),
  ]).slice(0, 8);
  const weakWords = rankWords([
    ...listening.flatMap((attempt) => attempt.unknownWords ?? []),
    ...speaking.flatMap((attempt) => attempt.correctedWords ?? []),
    ...dueReviewItems
      .filter((item) => (item.misses ?? 0) > (item.hits ?? 0))
      .flatMap((item) => extractMemoryWords(item.phrase)),
  ]).slice(0, 8);
  const correctionTargets = uniqueNormalized([
    ...speaking.flatMap((attempt) => attempt.correctedWords ?? []),
    ...speaking.map((attempt) => attempt.suggestion ?? ""),
    ...dueReviewItems.filter((item) => (item.misses ?? 0) > 0).map((item) => item.phrase),
  ]).slice(0, 6);
  const supportSignals = [
    listening.some((attempt) => attempt.translationOpened) ? "translation_support" : "",
    listening.some((attempt) => attempt.transcriptOpened) ? "transcript_support" : "",
    listening.some((attempt) => attempt.slowAudioUsed) ? "slow_audio_support" : "",
    listening.some((attempt) => Number(attempt.replayCount ?? 0) >= 3) ? "repeated_listening" : "",
    speaking.some((attempt) => attempt.pronunciationScore < 6) ? "pronunciation_accuracy" : "",
    speaking.some((attempt) => attempt.connectedSpeechScore < 6) ? "connected_speech" : "",
  ].filter(Boolean);
  const teacherFocus = [
    dueReviewItems.length ? `review ${compactPhrase(dueReviewItems[0].phrase, 8)}` : "",
    weakWords.length ? `repair ${weakWords.slice(0, 3).join(", ")}` : "",
    recentlyTaughtPhrases.length ? `reuse ${compactPhrase(recentlyTaughtPhrases[0], 8)}` : "",
  ].filter(Boolean).join("; ") || "introduce one new pattern and keep one old phrase active";

  return {
    recentlyTaughtPhrases,
    reviewPhrases: dueReviewItems.slice(0, 6),
    weakWords,
    correctionTargets,
    supportSignals,
    teacherFocus,
  };
};

const normalizeGoalText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const looksPortuguese = (value: string) => {
  const normalized = normalizeGoalText(value);

  return /\b(falar|fala|reuniao|reunioes|entrevista|entrevistas|trabalho|ingles|melhor|melhorar|praticar|viagem|viajar|atendimento|vendas|negocios|conversa|conversacao|pronuncia|escuta|ouvir)\b/.test(
    normalized
  );
};

const goalIncludes = (normalized: string, terms: string[]) => terms.some((term) => normalized.includes(term));

const buildGoalContext = (goal: string) => {
  const original = safeText(goal, "falar com mais confiança");
  const normalized = normalizeGoalText(original);
  const englishParts: string[] = [];
  const portugueseParts: string[] = [];

  if (goalIncludes(normalized, ["reuniao", "reunioes", "meeting", "meetings"])) {
    englishParts.push("meetings");
    portugueseParts.push("reuniões");
  }

  if (goalIncludes(normalized, ["entrevista", "entrevistas", "interview", "interviews"])) {
    englishParts.push("interviews");
    portugueseParts.push("entrevistas");
  }

  if (goalIncludes(normalized, ["apresentacao", "apresentacoes", "presentation", "presentations"])) {
    englishParts.push("presentations");
    portugueseParts.push("apresentações");
  }

  if (goalIncludes(normalized, ["conversa", "conversacao", "conversation", "conversations"])) {
    englishParts.push("conversations");
    portugueseParts.push("conversas");
  }

  if (goalIncludes(normalized, ["trabalho", "profissional", "work", "professional"])) {
    englishParts.push("work situations");
    portugueseParts.push("situações de trabalho");
  }

  if (goalIncludes(normalized, ["viagem", "viajar", "travel", "trip"])) {
    englishParts.push("travel situations");
    portugueseParts.push("situações de viagem");
  }

  if (goalIncludes(normalized, ["vendas", "sales"])) {
    englishParts.push("sales conversations");
    portugueseParts.push("conversas de vendas");
  }

  const englishPurpose = englishParts.length
    ? englishParts.length === 1
      ? englishParts[0]
      : `${englishParts.slice(0, -1).join(", ")} and ${englishParts[englishParts.length - 1]}`
    : looksPortuguese(original)
      ? "my current speaking goal"
      : original;
  const portuguesePurpose = portugueseParts.length
    ? portugueseParts.length === 1
      ? portugueseParts[0]
      : `${portugueseParts.slice(0, -1).join(", ")} e ${portugueseParts[portugueseParts.length - 1]}`
    : original;

  return {
    englishPurpose,
    portuguesePurpose,
    englishGoalSentence: `I want to practice English for ${englishPurpose}.`,
    portugueseGoalSentence: `Eu quero praticar inglês para ${portuguesePurpose}.`,
  };
};

const normalizeProfessionText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const memoryStopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "before",
  "can",
  "could",
  "for",
  "from",
  "have",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "now",
  "of",
  "on",
  "please",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
]);

const extractMemoryWords = (text: string) =>
  normalizeContentKey(text)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !memoryStopWords.has(word));

const compactPhrase = (value: string, maxWords = 11) => {
  const words = value.trim().replace(/\s+/g, " ").split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
};

const uniqueNormalized = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const text = item.trim().replace(/\s+/g, " ");
    const key = normalizeContentKey(text);

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(text);
  }

  return result;
};

const rankWords = (words: string[]) => {
  const counts = new Map<string, number>();

  for (const word of words) {
    const normalized = normalizeContentKey(word);

    if (!normalized || memoryStopWords.has(normalized)) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word);
};

const professionalTermTranslations: Record<string, string> = {
  access: "acesso",
  "api": "API",
  audience: "público",
  blocker: "bloqueio",
  "brand message": "mensagem da marca",
  bug: "problema",
  campaign: "campanha",
  "content calendar": "calendário de conteúdo",
  conversion: "conversão",
  "customer context": "contexto do cliente",
  deadline: "prazo",
  "decision maker": "pessoa responsável pela decisão",
  deployment: "implantação",
  "edge case": "caso extremo",
  escalation: "escalonamento",
  feedback: "retorno",
  "follow-up": "acompanhamento",
  layout: "leiaute",
  lead: "potencial cliente",
  objection: "objeção",
  priority: "prioridade",
  proposal: "proposta",
  prototype: "protótipo",
  "pull request": "solicitação de revisão",
  resolution: "resolução",
  result: "resultado",
  "response time": "tempo de resposta",
  stakeholder: "parte interessada",
  "staging logs": "logs do ambiente de homologação",
  "next step": "próximo passo",
  "user flow": "fluxo do usuário",
  "visual hierarchy": "hierarquia visual",
};

const professionalAreaTranslations: Record<string, string> = {
  "customer support": "suporte ao cliente",
  design: "design",
  designer: "design",
  developer: "desenvolvimento de software",
  doctor: "medicina",
  engineer: "engenharia",
  marketing: "marketing",
  physician: "medicina",
  sales: "vendas",
  "software development": "desenvolvimento de software",
  support: "suporte ao cliente",
  teacher: "educação",
  vendas: "vendas",
};

const translateProfessionalTerm = (term: string) =>
  professionalTermTranslations[normalizeProfessionText(term)] ?? term;

const translateProfessionalArea = (area: string) => {
  const normalized = normalizeProfessionText(area);

  if (professionalAreaTranslations[normalized]) {
    return professionalAreaTranslations[normalized];
  }

  return looksPortuguese(area) ? area : "sua área profissional";
};

const professionalProfile = (user: UserProfile) => {
  const profession = safeText(user.profession, "work");
  const goalContext = buildGoalContext(user.primaryGoal);

  if (user.professionalFocusMode !== "profession") {
    return {
      enabled: false,
      area: profession,
      scenario: `A short work conversation about priorities in ${profession}.`,
      task: `${profession} task`,
      terms: ["priority", "deadline", "next step"],
      phrases: [
        "I can explain the next step in simple English.",
        `My goal today is to practice ${goalContext.englishPurpose}.`,
      ],
    };
  }

  const normalized = normalizeProfessionText(profession);

  if (normalized.includes("marketing") || normalized.includes("growth") || normalized.includes("social media")) {
    return {
      enabled: true,
      area: "marketing",
      scenario: "A marketing check-in about campaign performance, audience, and next actions.",
      task: "marketing campaign",
      terms: ["campaign", "audience", "conversion", "content calendar", "brand message"],
      phrases: [
        "The campaign needs a clearer message for this audience.",
        "I will compare the conversion rate before changing the content.",
      ],
    };
  }

  if (normalized.includes("sales") || normalized.includes("vendas")) {
    return {
      enabled: true,
      area: "sales",
      scenario: "A sales conversation about leads, objections, follow-up, and proposals.",
      task: "sales pipeline",
      terms: ["lead", "objection", "proposal", "follow-up", "decision maker"],
      phrases: [
        "I need to understand the customer's main objection.",
        "I will send a clear follow-up with the next step.",
      ],
    };
  }

  if (normalized.includes("support") || normalized.includes("suporte") || normalized.includes("customer success")) {
    return {
      enabled: true,
      area: "customer support",
      scenario: "A support conversation about tickets, escalation, customer context, and resolution.",
      task: "customer support case",
      terms: ["ticket", "escalation", "resolution", "customer context", "response time"],
      phrases: [
        "I need more context before I escalate this ticket.",
        "I will explain the solution clearly to the customer.",
      ],
    };
  }

  if (normalized.includes("developer") || normalized.includes("desenvolvedor") || normalized.includes("engineer")) {
    return {
      enabled: true,
      area: "software development",
      scenario: "A technical conversation about a task, bug, API, review, or deployment.",
      task: "technical task",
      terms: ["bug", "API", "pull request", "deployment", "edge case"],
      phrases: [
        "I can explain the issue and suggest a solution.",
        "I need to check the API response before I continue.",
      ],
    };
  }

  if (normalized.includes("design") || normalized.includes("designer")) {
    return {
      enabled: true,
      area: "design",
      scenario: "A design review about layout, user flow, visual hierarchy, and feedback.",
      task: "design review",
      terms: ["layout", "user flow", "visual hierarchy", "feedback", "prototype"],
      phrases: [
        "The layout should make the main action clearer.",
        "I will update the prototype after the feedback.",
      ],
    };
  }

  return {
    enabled: true,
    area: profession,
    scenario: `A realistic professional conversation in ${profession}.`,
    task: `${profession} task`,
    terms: ["priority", "stakeholder", "deadline", "result", "next step"],
    phrases: [
      `I need to clarify the priority for this ${profession} task.`,
      `I can explain the result in simple English for my ${profession} context.`,
    ],
  };
};

const buildLevelProgressionScenarios = (user: UserProfile, memory: TeacherMemory) => {
  const level = normalizeLevel(user.currentLevel);
  const stage = learningStageCopy[level];
  const profile = professionalProfile(user);
  const goal = buildGoalContext(user.primaryGoal);
  const areaPtBr = translateProfessionalArea(profile.area);
  const primaryTerm = profile.terms[0] ?? "priority";
  const secondaryTerm = profile.terms[1] ?? "deadline";
  const primaryTermPtBr = translateProfessionalTerm(primaryTerm);
  const secondaryTermPtBr = translateProfessionalTerm(secondaryTerm);
  const scenarios: Record<EnglishLevel, PlanScenario[]> = {
    A1: [
      {
        title: "Clear First Answers",
        situation: `A short practice cycle for ${stage.label}: ${stage.focus}.`,
        dialogue: [
          "Coach: What do you need today?",
          `Student: ${goal.englishGoalSentence}`,
          "Coach: Can you say one useful sentence?",
          `Student: ${profile.phrases[0]}`,
        ],
        translations: [
          "Do que você precisa hoje?",
          goal.portugueseGoalSentence,
          "Você consegue dizer uma frase útil?",
          translateGeneratedPhrase(profile.phrases[0], profile.area),
        ],
        questions: [
          { prompt: "What does the student need?", answer: goal.englishPurpose },
          { prompt: "What sentence does the student practice?", answer: profile.phrases[0] },
        ],
      },
    ],
    A2: [
      {
        title: "Yesterday and Next Step",
        situation: `A practical A2 bridge using old phrases plus one new time frame in ${areaPtBr}.`,
        dialogue: [
          "Coach: What did you practice before?",
          "Student: I practiced short updates, and today I am going to ask better questions.",
          "Coach: What question will help you now?",
          `Student: Could you confirm the ${primaryTerm} before I continue?`,
        ],
        translations: [
          "O que você praticou antes?",
          "Eu pratiquei atualizações curtas, e hoje vou fazer perguntas melhores.",
          "Qual pergunta vai te ajudar agora?",
          `Você poderia confirmar ${primaryTermPtBr} antes de eu continuar?`,
        ],
        questions: [
          { prompt: "What did the student practice before?", answer: "Short updates." },
          { prompt: "What will the student ask about?", answer: primaryTerm },
        ],
      },
    ],
    B1: [
      {
        title: "Reason and Tradeoff",
        situation: `A B1 conversation that mixes review language with a new reason and tradeoff in ${areaPtBr}.`,
        dialogue: [
          "Manager: What is the main tradeoff?",
          `Student: If the ${primaryTerm} changes, we should adjust the next step.`,
          "Manager: Why is that important?",
          `Student: Because the ${secondaryTerm} affects the expected result.`,
        ],
        translations: [
          "Qual é o principal tradeoff?",
          `Se ${primaryTermPtBr} mudar, devemos ajustar o próximo passo.`,
          "Por que isso é importante?",
          `Porque ${secondaryTermPtBr} afeta o resultado esperado.`,
        ],
        questions: [
          { prompt: "What should change if the priority changes?", answer: "The next step." },
          { prompt: "What affects the expected result?", answer: secondaryTerm },
        ],
      },
    ],
    B2: [
      {
        title: "Priority and Constraint",
        situation: `A B2 practice cycle for nuance, prioritization, and constraints in ${areaPtBr}.`,
        dialogue: [
          "Lead: How would you prioritize this?",
          `Student: I would prioritize the ${primaryTerm}, unless the ${secondaryTerm} becomes urgent.`,
          "Lead: What would you communicate to the team?",
          "Student: I would explain the constraint and propose a smaller first step.",
        ],
        translations: [
          "Como você priorizaria isso?",
          `Eu priorizaria ${primaryTermPtBr}, a menos que ${secondaryTermPtBr} se torne urgente.`,
          "O que você comunicaria para a equipe?",
          "Eu explicaria a restrição e proporia um primeiro passo menor.",
        ],
        questions: [
          { prompt: "What would the student prioritize?", answer: primaryTerm },
          { prompt: "What would the student propose?", answer: "A smaller first step." },
        ],
      },
    ],
    C1: [
      {
        title: "Concise Recommendation",
        situation: `A C1 practice cycle for synthesis, hedging, and concise recommendations in ${areaPtBr}.`,
        dialogue: [
          "Director: What is your recommendation?",
          `Student: Given the ${primaryTerm}, I would recommend a staged approach.`,
          "Director: What risk should we watch?",
          `Student: The main risk is overcommitting before the ${secondaryTerm} is clear.`,
        ],
        translations: [
          "Qual é a sua recomendação?",
          `Considerando ${primaryTermPtBr}, eu recomendaria uma abordagem em etapas.`,
          "Qual risco devemos observar?",
          `O principal risco é assumir compromissos demais antes que ${secondaryTermPtBr} esteja claro.`,
        ],
        questions: [
          { prompt: "What approach does the student recommend?", answer: "A staged approach." },
          { prompt: "What is the main risk?", answer: "Overcommitting too early." },
        ],
      },
    ],
  };

  return scenarios[level];
};

const buildMemoryScenario = (memory: TeacherMemory): PlanScenario | null => {
  const reviewPhrase = memory.reviewPhrases[0]?.phrase ?? memory.recentlyTaughtPhrases[0];
  const weakWord = memory.weakWords[0];

  if (!reviewPhrase && !weakWord) {
    return null;
  }

  const compactReviewPhrase = compactPhrase(reviewPhrase ?? "the phrase from yesterday", 9);
  const targetWord = weakWord ?? extractMemoryWords(reviewPhrase ?? "")[0] ?? "phrase";

  return {
    title: "Teacher Memory Review",
    situation: "A teacher-led review that connects yesterday's content with today's next step.",
    dialogue: [
      "Teacher: What did we practice recently?",
      `Student: We practiced "${compactReviewPhrase}".`,
      "Teacher: What should we improve today?",
      `Student: I will use "${targetWord}" in a new sentence and say it clearly.`,
    ],
    translations: [
      "O que praticamos recentemente?",
      `Nós praticamos "${compactReviewPhrase}".`,
      "O que devemos melhorar hoje?",
      `Vou usar "${targetWord}" em uma frase nova e falar com clareza.`,
    ],
    questions: [
      { prompt: "What did the student practice recently?", answer: compactReviewPhrase },
      { prompt: "What will the student improve today?", answer: targetWord },
    ],
  };
};

const buildPlanScenario = (user: UserProfile, dailyPlan: DailyPlan, memory: TeacherMemory) => {
  const goal = buildGoalContext(user.primaryGoal);
  const profile = professionalProfile(user);
  const memoryScenario = buildMemoryScenario(memory);

  if (memoryScenario) {
    return memoryScenario;
  }

  const scenarios: PlanScenario[] = [
    {
      title: "Planning the Next Task",
      situation: profile.scenario,
      dialogue: [
        "Manager: What is your main focus for this session?",
        `Student: ${goal.englishGoalSentence}`,
        "Manager: Good. What is one small task you can finish now?",
        `Student: ${profile.phrases[0]}`,
      ],
      translations: [
        "Qual é o seu foco principal nesta sessão?",
        goal.portugueseGoalSentence,
        "Certo. Qual é uma pequena tarefa que você consegue terminar agora?",
        translateGeneratedPhrase(profile.phrases[0], profile.area),
      ],
      questions: [
        { prompt: "What does the student want to practice?", answer: goal.englishPurpose },
        { prompt: "What can the student explain?", answer: "The next step in simple English." },
      ],
    },
    {
      title: "Explaining a Blocker",
      situation: profile.enabled
        ? `A teammate asks for a clear ${profile.area} update.`
        : "A teammate asks for a clear update about a blocker.",
      dialogue: [
        "Teammate: Are you blocked on anything right now?",
        "Student: Yes, I need more context before I continue.",
        "Teammate: What context do you need?",
        `Student: I need the goal and the expected result for this ${profile.task}.`,
      ],
      translations: [
        "Você está bloqueado em alguma coisa agora?",
        "Sim, eu preciso de mais contexto antes de continuar.",
        "De que contexto você precisa?",
        `Eu preciso do objetivo e do resultado esperado para esta tarefa de ${profile.area}.`,
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
        "O que você praticou neste ciclo?",
        "Eu pratiquei respostas curtas e frases úteis de trabalho.",
        "O que você deve fazer agora?",
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
        "Você consegue cuidar disso hoje?",
        "Eu consigo, mas preciso confirmar um detalhe primeiro.",
        "Claro. O que você quer confirmar?",
        "Eu quero confirmar a prioridade e o prazo.",
      ],
      questions: [
        { prompt: "Can the student handle the task?", answer: "Yes, after confirming one detail." },
        { prompt: "What does the student confirm?", answer: "The priority and the deadline." },
      ],
    },
    ...buildLevelProgressionScenarios(user, memory),
  ];

  return scenarios[dailyProgressionSeed(dailyPlan, user) % scenarios.length];
};

const chunkByPhrase = (text: string, translation: string) => {
  const words = text.replace(/[?.!]/g, "").split(/\s+/).filter(Boolean);

  if (words.length <= 4) {
    return [{ text, translation: translation }];
  }

  const middle = Math.ceil(words.length / 2);
  return [
    { text: words.slice(0, middle).join(" "), translation: translation },
    { text: words.slice(middle).join(" "), translation: "parte final da ideia" },
  ];
};

const buildShadowingItem = (item: {
  id: string;
  text: string;
  translation: string;
  explanation?: string;
  pronunciationTip: string;
  chunks?: ReturnType<typeof chunkByPhrase>;
  additionalExample?: string;
  semantic?: ContentSemanticMetadata;
}): ShadowingItem => ({
  id: item.id,
  text: item.text,
  translation: item.translation,
  explanation: item.explanation ?? `Use esta frase em uma situação prática: ${item.translation}`,
  chunks: item.chunks ?? chunkByPhrase(item.text, item.translation),
  pronunciationTip: item.pronunciationTip,
  language: "en",
  translationLanguage: "pt-BR",
  ...(item.additionalExample ? { additionalExample: item.additionalExample } : {}),
  ...(item.semantic ? { semantic: item.semantic } : {}),
});

const translateGeneratedPhrase = (phrase: string, area: string) => {
  const areaPtBr = translateProfessionalArea(area);
  const translations: Record<string, string> = {
    "I can explain the next step in simple English.": "Eu consigo explicar o próximo passo em inglês simples.",
    "The campaign needs a clearer message for this audience.":
      "A campanha precisa de uma mensagem mais clara para esse público.",
    "I will compare the conversion rate before changing the content.":
      "Vou comparar a taxa de conversão antes de mudar o conteúdo.",
    "I need to understand the customer's main objection.":
      "Eu preciso entender a principal objeção do cliente.",
    "I will send a clear follow-up with the next step.":
      "Vou enviar um acompanhamento claro com o próximo passo.",
    "I need more context before I escalate this ticket.":
      "Eu preciso de mais contexto antes de encaminhar esse chamado.",
    "I will explain the solution clearly to the customer.":
      "Vou explicar a solução com clareza para o cliente.",
    "I can explain the issue and suggest a solution.":
      "Eu consigo explicar o problema e sugerir uma solução.",
    "I need to check the API response before I continue.":
      "Eu preciso verificar a resposta da API antes de continuar.",
    "The layout should make the main action clearer.":
      "O leiaute deve deixar a ação principal mais clara.",
    "I will update the prototype after the feedback.":
      "Vou atualizar o protótipo depois do retorno.",
  };

  if (translations[phrase]) {
    return translations[phrase];
  }

  if (phrase.startsWith("I need to clarify the priority for this")) {
    return `Eu preciso esclarecer a prioridade desta tarefa de ${areaPtBr}.`;
  }

  if (phrase.startsWith("I can explain the result in simple English")) {
    return `Eu consigo explicar o resultado em inglês simples no contexto de ${areaPtBr}.`;
  }

  if (phrase.startsWith("My goal today is to practice")) {
    return "Meu objetivo hoje é praticar esse foco em inglês.";
  }

  return `Frase útil para ${areaPtBr}.`;
};

const buildShadowingCandidates = (user: UserProfile, dailyPlan: DailyPlan, memory: TeacherMemory): ShadowingItem[] => {
  const goal = buildGoalContext(user.primaryGoal);
  const profile = professionalProfile(user);
  const area = profile.area;
  const areaPtBr = translateProfessionalArea(area);
  const terms = profile.terms.length ? profile.terms : ["priority", "deadline", "next step"];
  const primaryTerm = terms[0] ?? "priority";
  const secondaryTerm = terms[1] ?? "deadline";
  const tertiaryTerm = terms[2] ?? "next step";
  const primaryTermPtBr = translateProfessionalTerm(primaryTerm);
  const secondaryTermPtBr = translateProfessionalTerm(secondaryTerm);
  const tertiaryTermPtBr = translateProfessionalTerm(tertiaryTerm);
  const specs = [
    {
      text: profile.phrases[0],
      translation: translateGeneratedPhrase(profile.phrases[0], area),
      explanation: `Use em atualizações de ${areaPtBr}.`,
      tip: "Destaque o termo profissional principal e mantenha o final claro.",
    },
    {
      text: profile.enabled ? profile.phrases[1] : goal.englishGoalSentence,
      translation: profile.enabled ? translateGeneratedPhrase(profile.phrases[1], area) : goal.portugueseGoalSentence,
      explanation: "Use para transformar seu objetivo em uma frase curta e treinável.",
      tip: "Faça uma pausa breve depois da ideia principal e termine com confiança.",
    },
    {
      text: `I need to clarify the ${primaryTerm} before I continue.`,
      translation: `Eu preciso esclarecer ${primaryTermPtBr} antes de continuar.`,
      explanation: "Use quando falta uma informação importante para seguir.",
      tip: "Conecte 'need to' naturalmente, próximo de 'needta'.",
    },
    {
      text: `The ${secondaryTerm} is important for the next step.`,
      translation: `${secondaryTermPtBr} é importante para o próximo passo.`,
      explanation: "Use para explicar por que uma informação afeta a próxima ação.",
      tip: "Dê ênfase ao termo principal e finalize 'next step' com clareza.",
    },
    {
      text: `I will update the team after I check the ${tertiaryTerm}.`,
      translation: `Vou atualizar a equipe depois de verificar ${tertiaryTermPtBr}.`,
      explanation: "Use quando você promete retorno depois de confirmar uma informação.",
      tip: "Mantenha 'will update' conectado e claro.",
    },
    {
      text: `Can you confirm the ${primaryTerm} for this ${area} task?`,
      translation: `Você pode confirmar ${primaryTermPtBr} para esta tarefa de ${areaPtBr}?`,
      explanation: "Use para pedir confirmação de forma direta e educada.",
      tip: "Reduza 'can you' naturalmente e destaque a informação pedida.",
    },
    {
      text: `I can explain the result in simple English.`,
      translation: "Eu consigo explicar o resultado em inglês simples.",
      explanation: "Use para praticar clareza antes de falar com mais detalhes.",
      tip: "Dê ritmo a 'simple English' sem correr.",
    },
    {
      text: `I am working on the ${tertiaryTerm} now.`,
      translation: `Estou trabalhando em ${tertiaryTermPtBr} agora.`,
      explanation: "Use para dar uma atualização curta sobre o que você está fazendo.",
      tip: "Conecte 'working on' de forma fluida.",
    },
    {
      text: "I need one more example before I decide.",
      translation: "Preciso de mais um exemplo antes de decidir.",
      explanation: "Use quando você precisa de mais evidência antes de escolher.",
      tip: "Dê ênfase a 'one more example'.",
    },
    {
      text: "I can give you a quick update now.",
      translation: "Posso te dar uma atualização rápida agora.",
      explanation: "Use para iniciar uma atualização curta em contexto profissional.",
      tip: "Mantenha 'quick update' como um bloco só.",
    },
    {
      text: "I want to make sure I understand the goal.",
      translation: "Quero garantir que entendi o objetivo.",
      explanation: "Use quando você quer confirmar entendimento antes de agir.",
      tip: "Fale 'make sure' como uma unidade natural.",
    },
    {
      text: "I will practice this phrase again during review.",
      translation: "Vou praticar esta frase novamente durante a revisão.",
      explanation: "Use para marcar uma frase como revisão intencional.",
      tip: "Dê uma pausa leve antes de 'during review'.",
    },
  ];
  const level = normalizeLevel(user.currentLevel);
  const memorySpecs = [
    ...(memory.recentlyTaughtPhrases[0]
      ? [
          {
            text: `I practiced "${compactPhrase(memory.recentlyTaughtPhrases[0], 8)}" before, and today I can use it again.`,
            translation: `Eu pratiquei "${compactPhrase(memory.recentlyTaughtPhrases[0], 8)}" antes, e hoje consigo usar de novo.`,
            explanation: "Use para transformar conteúdo antigo em fala ativa novamente.",
            tip: "Faça uma pausa breve depois da frase revisada e termine com confiança.",
          },
        ]
      : []),
    ...(memory.weakWords[0]
      ? [
          {
            text: `I will practice the word "${memory.weakWords[0]}" in a clear sentence.`,
            translation: `Vou praticar a palavra "${memory.weakWords[0]}" em uma frase clara.`,
            explanation: "Use para atacar uma palavra que apareceu como fraca no seu histórico.",
            tip: "Diga a palavra-alvo devagar uma vez, depois repita a frase inteira.",
          },
        ]
      : []),
    ...(memory.supportSignals.includes("connected_speech")
      ? [
          {
            text: "I will connect the words, but I will not rush.",
            translation: "Vou conectar as palavras, mas não vou correr.",
            explanation: "Use quando o histórico mostra que fluidez e conexão precisam de atenção.",
            tip: "Conecte 'will connect' e mantenha 'not rush' bem claro.",
          },
        ]
      : []),
  ];
  const levelSpecs: Record<EnglishLevel, typeof specs> = {
    A1: [
      {
        text: "I can say this in a simple way.",
        translation: "Eu consigo dizer isso de um jeito simples.",
        explanation: "Use para ganhar confiança com uma frase curta e reaproveitável.",
        tip: "Fale 'simple way' como uma unidade curta.",
      },
      {
        text: `Can you help me with the ${primaryTerm}?`,
        translation: `Você pode me ajudar com ${primaryTermPtBr}?`,
        explanation: "Use para pedir ajuda de forma direta.",
        tip: "Reduza 'can you' naturalmente e termine com clareza.",
      },
    ],
    A2: [
      {
        text: "I practiced this before, and now I can use it faster.",
        translation: "Eu pratiquei isso antes, e agora consigo usar mais rápido.",
        explanation: "Use para conectar revisão antiga com fluência nova.",
        tip: "Separe levemente 'before' e conecte 'now I can'.",
      },
      {
        text: `I am going to check the ${secondaryTerm} after this meeting.`,
        translation: `Vou verificar ${secondaryTermPtBr} depois desta reunião.`,
        explanation: "Use para praticar plano futuro com 'going to'.",
        tip: "Fale 'going to' de forma conectada, sem acelerar o resto.",
      },
      {
        text: `Could you confirm the ${primaryTerm} before I continue?`,
        translation: `Você poderia confirmar ${primaryTermPtBr} antes de eu continuar?`,
        explanation: "Use para fazer um pedido educado em uma situação real.",
        tip: "Destaque 'confirm' e mantenha a pergunta leve.",
      },
    ],
    B1: [
      {
        text: `If the ${primaryTerm} changes, we should adjust the next step.`,
        translation: `Se ${primaryTermPtBr} mudar, devemos ajustar o próximo passo.`,
        explanation: "Use para praticar condição e consequência em uma fala profissional.",
        tip: "Faça uma pausa curta depois da condição com 'if'.",
      },
      {
        text: `The main tradeoff is the ${primaryTerm} versus the ${secondaryTerm}.`,
        translation: `O principal tradeoff é ${primaryTermPtBr} versus ${secondaryTermPtBr}.`,
        explanation: "Use para comparar duas forças importantes sem falar demais.",
        tip: "Dê ênfase em 'main tradeoff' e mantenha 'versus' claro.",
      },
      {
        text: "I can explain the reason behind this decision.",
        translation: "Eu consigo explicar o motivo por trás desta decisão.",
        explanation: "Use para subir de frases soltas para explicações completas.",
        tip: "Conecte 'reason behind' como um bloco natural.",
      },
    ],
    B2: [
      {
        text: `I would prioritize the ${primaryTerm}, unless the ${secondaryTerm} becomes urgent.`,
        translation: `Eu priorizaria ${primaryTermPtBr}, a menos que ${secondaryTermPtBr} se torne urgente.`,
        explanation: "Use para praticar nuance, exceção e priorização.",
        tip: "Faça uma pausa clara antes de 'unless'.",
      },
      {
        text: "I would explain the constraint and propose a smaller first step.",
        translation: "Eu explicaria a restrição e proporia um primeiro passo menor.",
        explanation: "Use para soar claro quando há limitação e decisão.",
        tip: "Mantenha 'smaller first step' firme no final.",
      },
    ],
    C1: [
      {
        text: `Given the ${primaryTerm}, I would recommend a staged approach.`,
        translation: `Considerando ${primaryTermPtBr}, eu recomendaria uma abordagem em etapas.`,
        explanation: "Use para dar recomendação concisa com tom profissional.",
        tip: "Dê ritmo a 'staged approach' sem alongar demais.",
      },
      {
        text: `The main risk is overcommitting before the ${secondaryTerm} is clear.`,
        translation: `O principal risco é assumir compromissos demais antes que ${secondaryTermPtBr} esteja claro.`,
        explanation: "Use para resumir risco com precisão.",
        tip: "Reduza 'overcommitting' em sílabas claras e termine com calma.",
      },
    ],
  };
  const mixedSpecs = rotateItems([...memorySpecs, ...specs, ...levelSpecs[level]], dailyProgressionSeed(dailyPlan, user));

  return mixedSpecs.map((spec) =>
    buildShadowingItem({
      id: stableContentId("shadowing", spec.text),
      text: spec.text,
      translation: spec.translation,
      explanation: spec.explanation,
      pronunciationTip: spec.tip,
      chunks: chunkByPhrase(spec.text, spec.translation),
    })
  );
};

const selectShadowingItems = (
  candidates: ShadowingItem[],
  catalogItems: ShadowingItem[],
  dailyPlan: DailyPlan,
  history: PersonalizationHistory = {}
) => {
  const completed = (history.completedActivities ?? [])
    .filter((activity) => activity.type === "shadowing" || activity.type === "repetition")
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const trainedIds = new Set(completed.map((activity) => activity.itemId));
  const trainedTexts = new Set(completed.map((activity) => normalizeContentKey(activity.title)));
  const recentlyTrainedTexts = new Set(completed.slice(0, 12).map((activity) => normalizeContentKey(activity.title)));
  const seed = getPlanRotation(dailyPlan) + numericDateSeed(dailyPlan.date);
  const pool = rotateItems(uniqueBy([...candidates, ...catalogItems], (item) => item.text), seed);
  const fresh = pool.filter(
    (item) => !trainedIds.has(item.id) && !trainedTexts.has(normalizeContentKey(item.text))
  );
  const review = pool.filter(
    (item) => trainedIds.has(item.id) || trainedTexts.has(normalizeContentKey(item.text))
  );
  const spacedReview = review.filter((item) => !recentlyTrainedTexts.has(normalizeContentKey(item.text)));
  const selectedFresh = fresh.slice(0, 4);
  const selectedReview = spacedReview.slice(0, selectedFresh.length >= 3 ? 1 : 2);
  const selected = uniqueBy([...selectedFresh, ...selectedReview], (item) => item.text);

  if (selected.length >= 3) {
    return selected;
  }

  return uniqueBy([...selected, ...pool], (item) => item.text).slice(0, 4);
};

const buildPlanListeningLesson = (user: UserProfile, dailyPlan: DailyPlan, memory: TeacherMemory): ListeningLesson => {
  const rotation = getPlanRotation(dailyPlan);
  const scenario = buildPlanScenario(user, dailyPlan, memory);
  const level = normalizeLevel(user.currentLevel);
  const scenarioKey = stableContentId("listening", `${dailyPlan.date}-${level}-${scenario.title}`);

  return {
    id: scenarioKey,
    title: scenario.title,
    level,
    situationDescription: scenario.situation,
    dialogue: scenario.dialogue,
    questions: scenario.questions.map((question, index) => ({
      id: `plan-question-${dailyPlan.date}-${level}-${rotation}-${index + 1}`,
      ...question,
    })),
    comprehension: scenario.dialogue.map((line, index) => {
      const text = line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line;
      const translation = scenario.translations[index] ?? "Tradução em português indisponível.";

      return {
        sourceText: text,
        translation,
        translationPtBr: translation,
        context: "Use esta frase como parte do ciclo atual de estudo.",
        chunks: chunkByPhrase(text, translation),
        pronunciationTip: "Mantenha a frase curta, clara e conectada.",
      };
    }),
  };
};

const buildSemanticListeningLesson = (context: SemanticContext, user: UserProfile, dailyPlan: DailyPlan): ListeningLesson => ({
  id: stableContentId("semantic-listening", `${dailyPlan.date}:${context.scenario}`),
  title: context.title,
  level: normalizeLevel(user.currentLevel),
  situationDescription: `${context.setting}: ${context.scenario.replace(/_/g, " ")}`,
  dialogue: context.dialogue,
  questions: [
    { id: "semantic-question-1", prompt: "What is the situation?", answer: context.scenario.replace(/_/g, " ") },
    { id: "semantic-question-2", prompt: "What does the learner want?", answer: context.communicativeGoal.replace(/_/g, " ") },
  ],
  semantic: context,
  comprehension: context.dialogue.map((text, index) => ({
    sourceText: text.includes(":") ? text.slice(text.indexOf(":") + 1).trim() : text,
    translation: context.translations[index],
    translationPtBr: context.translations[index],
    context: context.scenario.replace(/_/g, " "),
  })),
});

const buildSemanticVocabulary = (context: SemanticContext, user: UserProfile, dailyPlan: DailyPlan): VocabularyItem => ({
  id: stableContentId("semantic-vocabulary", `${dailyPlan.date}:${context.vocabularyPhrase}`),
  phrase: context.vocabularyPhrase,
  translation: context.vocabularyTranslation,
  level: normalizeLevel(user.currentLevel),
  category: `${context.topic}: ${context.subtopic}`,
  sentences: [{ text: context.vocabularyPhrase, translation: context.vocabularyTranslation }],
  confidence: 50,
  nextReviewAt: new Date(`${dailyPlan.date}T12:00:00.000Z`).toISOString(),
  hits: 0,
  misses: 0,
  source: "semantic_daily_plan",
  semantic: context,
});

const buildSemanticShadowing = (context: SemanticContext, dailyPlan: DailyPlan): ShadowingItem => buildShadowingItem({
  id: stableContentId("semantic-shadowing", `${dailyPlan.date}:${context.shadowingPhrase}`),
  text: context.shadowingPhrase,
  translation: context.shadowingTranslation,
  explanation: `Contexto: ${context.topic} / ${context.scenario.replace(/_/g, " ")}.`,
  pronunciationTip: "Fale em blocos curtos e conecte as palavras naturalmente.",
  chunks: chunkByPhrase(context.shadowingPhrase, context.shadowingTranslation),
  semantic: context,
});

const buildSemanticThinkPrompt = (context: SemanticContext, dailyPlan: DailyPlan): ThinkInEnglishPrompt => ({
  id: stableContentId("semantic-think", `${dailyPlan.date}:${context.thinkPrompt}`),
  userMessage: context.thinkPrompt,
  coachReply: context.thinkReply,
  semantic: context,
});

const buildSemanticConversationMode = (context: SemanticContext, dailyPlan: DailyPlan): ConversationMode => ({
  id: stableContentId("semantic-conversation", `${dailyPlan.date}:${context.scenario}`),
  title: context.title,
  description: `Practice ${context.communicativeGoal.replace(/_/g, " ")} in a ${context.setting}.`,
  audience: "general",
  starter: context.dialogue[0],
  semantic: context,
});

const buildPlanShadowingItems = (user: UserProfile, dailyPlan: DailyPlan, memory: TeacherMemory): ShadowingItem[] =>
  buildShadowingCandidates(user, dailyPlan, memory);

const buildPlanVocabulary = (user: UserProfile, dailyPlan: DailyPlan, memory: TeacherMemory): VocabularyItem[] => {
  const rotation = getPlanRotation(dailyPlan);
  const level = normalizeLevel(user.currentLevel);
  const profile = professionalProfile(user);
  const primaryTerm = profile.terms[0] ?? "priority";
  const secondaryTerm = profile.terms[1] ?? "deadline";
  const primaryTermPtBr = translateProfessionalTerm(primaryTerm);
  const secondaryTermPtBr = translateProfessionalTerm(secondaryTerm);
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + Math.max(1, 3 - Math.min(2, levelRank(level))));
  const makeItem = (
    idPart: string,
    phrase: string,
    translation: string,
    category: string,
    sentences: VocabularyItem["sentences"]
  ): VocabularyItem => ({
    id: `plan-vocab-${dailyPlan.date}-${rotation}-${idPart}`,
    phrase,
    translation,
    level,
    category,
    sentences,
    confidence: 50,
    nextReviewAt: nextReview.toISOString(),
    hits: 0,
    misses: 0,
    source: "plan_generated",
    timesPracticed: 0,
    timesCorrect: 0,
    timesWrong: 0,
  });
  const progressionItems: Record<EnglishLevel, VocabularyItem[]> = {
    A1: [
      makeItem("a1-help", `Can you help me with the ${primaryTerm}?`, `Você pode me ajudar com ${primaryTermPtBr}?`, "A1 useful question", [
        { text: `Can you help me with the ${primaryTerm}?`, translation: `Você pode me ajudar com ${primaryTermPtBr}?` },
        { text: "I need help with this part.", translation: "Preciso de ajuda com esta parte." },
        { text: "I can try again now.", translation: "Eu posso tentar de novo agora." },
      ]),
    ],
    A2: [
      makeItem(
        "a2-before-now",
        "I practiced this before, and now I can use it faster.",
        "Eu pratiquei isso antes, e agora consigo usar mais rápido.",
        "A2 past plus now",
        [
          { text: "I practiced this before.", translation: "Eu pratiquei isso antes." },
          { text: "Now I can use it faster.", translation: "Agora consigo usar isso mais rápido." },
          { text: `I am going to check the ${secondaryTerm}.`, translation: `Vou verificar ${secondaryTermPtBr}.` },
        ]
      ),
      makeItem(
        "a2-polite-confirm",
        `Could you confirm the ${primaryTerm} before I continue?`,
        `Você poderia confirmar ${primaryTermPtBr} antes de eu continuar?`,
        "A2 polite request",
        [
          { text: `Could you confirm the ${primaryTerm}?`, translation: `Você poderia confirmar ${primaryTermPtBr}?` },
          { text: "I need to confirm one detail first.", translation: "Preciso confirmar um detalhe primeiro." },
          { text: "I am going to continue after that.", translation: "Vou continuar depois disso." },
        ]
      ),
    ],
    B1: [
      makeItem(
        "b1-if-adjust",
        `If the ${primaryTerm} changes, we should adjust the next step.`,
        `Se ${primaryTermPtBr} mudar, devemos ajustar o próximo passo.`,
        "B1 condition and result",
        [
          { text: `If the ${primaryTerm} changes, we should adjust the next step.`, translation: `Se ${primaryTermPtBr} mudar, devemos ajustar o próximo passo.` },
          { text: `Because the ${secondaryTerm} affects the expected result.`, translation: `Porque ${secondaryTermPtBr} afeta o resultado esperado.` },
          { text: "What is the main tradeoff?", translation: "Qual é o principal tradeoff?" },
        ]
      ),
      makeItem(
        "b1-reason",
        "I can explain the reason behind this decision.",
        "Eu consigo explicar o motivo por trás desta decisão.",
        "B1 reasons",
        [
          { text: "I can explain the reason behind this decision.", translation: "Eu consigo explicar o motivo por trás desta decisão." },
          { text: "The main tradeoff is speed versus quality.", translation: "O principal tradeoff é velocidade versus qualidade." },
          { text: "This affects the next step.", translation: "Isso afeta o próximo passo." },
        ]
      ),
    ],
    B2: [
      makeItem(
        "b2-unless",
        `I would prioritize the ${primaryTerm}, unless the ${secondaryTerm} becomes urgent.`,
        `Eu priorizaria ${primaryTermPtBr}, a menos que ${secondaryTermPtBr} se torne urgente.`,
        "B2 nuance",
        [
          { text: `I would prioritize the ${primaryTerm}.`, translation: `Eu priorizaria ${primaryTermPtBr}.` },
          { text: `Unless the ${secondaryTerm} becomes urgent.`, translation: `A menos que ${secondaryTermPtBr} se torne urgente.` },
          { text: "I would propose a smaller first step.", translation: "Eu proporia um primeiro passo menor." },
        ]
      ),
    ],
    C1: [
      makeItem(
        "c1-recommend",
        `Given the ${primaryTerm}, I would recommend a staged approach.`,
        `Considerando ${primaryTermPtBr}, eu recomendaria uma abordagem em etapas.`,
        "C1 recommendation",
        [
          { text: `Given the ${primaryTerm}, I would recommend a staged approach.`, translation: `Considerando ${primaryTermPtBr}, eu recomendaria uma abordagem em etapas.` },
          { text: `The main risk is overcommitting before the ${secondaryTerm} is clear.`, translation: `O principal risco é assumir compromissos demais antes que ${secondaryTermPtBr} esteja claro.` },
          { text: "This is a concise recommendation.", translation: "Esta é uma recomendação concisa." },
        ]
      ),
    ],
  };
  const memoryItems = [
    ...memory.reviewPhrases.map((item, index) => ({
      ...item,
      id: `memory-review-${dailyPlan.date}-${index + 1}-${item.id}`,
      category: `Teacher review: ${item.category}`,
      source: item.source ?? "teacher_memory",
    })),
    ...(memory.weakWords[0]
      ? [
          makeItem(
            "memory-weak-word",
            `I need to use "${memory.weakWords[0]}" in a complete sentence.`,
            `Preciso usar "${memory.weakWords[0]}" em uma frase completa.`,
            "Teacher memory repair",
            [
              {
                text: `I need to use "${memory.weakWords[0]}" in a complete sentence.`,
                translation: `Preciso usar "${memory.weakWords[0]}" em uma frase completa.`,
              },
              {
                text: `Can you give me one example with "${memory.weakWords[0]}"?`,
                translation: `Você pode me dar um exemplo com "${memory.weakWords[0]}"?`,
              },
              {
                text: "I will repeat it once and then use it in context.",
                translation: "Vou repetir uma vez e depois usar em contexto.",
              },
            ]
          ),
        ]
      : []),
    ...(memory.recentlyTaughtPhrases[0]
      ? [
          makeItem(
            "memory-old-new",
            "I can reuse an old phrase in a new situation.",
            "Eu consigo reutilizar uma frase antiga em uma situação nova.",
            "Teacher memory bridge",
            [
              {
                text: `I practiced "${compactPhrase(memory.recentlyTaughtPhrases[0], 8)}" before.`,
                translation: `Eu pratiquei "${compactPhrase(memory.recentlyTaughtPhrases[0], 8)}" antes.`,
              },
              {
                text: "Now I can use it in a new situation.",
                translation: "Agora consigo usar isso em uma situação nova.",
              },
              {
                text: "This helps me speak with less translation.",
                translation: "Isso me ajuda a falar com menos tradução.",
              },
            ]
          ),
        ]
      : []),
  ];

  return uniqueBy(
    [
      ...memoryItems,
      makeItem(
        "review-core",
        profile.enabled ? `I need to clarify the ${primaryTerm} first.` : "I need to confirm one detail first.",
        profile.enabled ? `Preciso esclarecer ${primaryTermPtBr} primeiro.` : "Preciso confirmar um detalhe primeiro.",
        profile.enabled ? `${profile.area} review bridge` : "Current plan review bridge",
        [
          { text: profile.phrases[0], translation: translateGeneratedPhrase(profile.phrases[0], profile.area) },
          { text: `I need to confirm the ${primaryTerm}.`, translation: `Preciso confirmar ${primaryTermPtBr}.` },
          { text: `The ${secondaryTerm} is important for the next step.`, translation: `${secondaryTermPtBr} é importante para o próximo passo.` },
        ]
      ),
      ...rotateItems(progressionItems[level], dailyProgressionSeed(dailyPlan, user)).slice(0, 2),
      makeItem(
        "clear-next-step",
        "I can explain my next step clearly.",
        "Eu consigo explicar meu próximo passo com clareza.",
        "Current plan consolidation",
        [
          { text: "I can explain my next step clearly.", translation: "Eu consigo explicar meu próximo passo com clareza." },
          { text: "I can explain the blocker clearly.", translation: "Eu consigo explicar o bloqueio com clareza." },
          { text: "I can explain the expected result clearly.", translation: "Eu consigo explicar o resultado esperado com clareza." },
        ]
      ),
    ],
    (item) => item.phrase
  );
};

const buildPlanThinkPrompt = (dailyPlan: DailyPlan, user: UserProfile, memory: TeacherMemory): ThinkInEnglishPrompt => {
  const level = normalizeLevel(user.currentLevel);
  const hasMemoryEvidence = Boolean(
    memory.recentlyTaughtPhrases.length ||
      memory.reviewPhrases.length ||
      memory.weakWords.length ||
      memory.correctionTargets.length ||
      memory.supportSignals.length
  );
  const memoryPrompt = hasMemoryEvidence
    ? {
        userMessage: "Quero que você use meu histórico para escolher meu próximo passo.",
        coachReply: `Teacher memory: ${memory.teacherFocus}. Use one old phrase, then add one new sentence for ${level}.`,
      }
    : null;
  const prompts: Record<EnglishLevel, Omit<ThinkInEnglishPrompt, "id">> = {
    A1: {
      userMessage: "Quero falar sobre meu plano de estudo de hoje.",
      coachReply: "Start in English with one short sentence: Today, I want to practice...",
    },
    A2: {
      userMessage: "Quero usar uma frase antiga com uma ideia nova.",
      coachReply: "Use this frame: I practiced this before, and now I can...",
    },
    B1: {
      userMessage: "Quero explicar o motivo de uma decisão.",
      coachReply: "Build a B1 answer: The reason is... If this changes, we should...",
    },
    B2: {
      userMessage: "Quero priorizar uma tarefa com nuance.",
      coachReply: "Try: I would prioritize..., unless... Then add one clear constraint.",
    },
    C1: {
      userMessage: "Quero fazer uma recomendação profissional curta.",
      coachReply: "Try: Given..., I would recommend... The main risk is...",
    },
  };

  return {
    id: `plan-think-${dailyPlan.date}-${level}-${getPlanRotation(dailyPlan)}`,
    ...(memoryPrompt ?? prompts[level]),
  };
};

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

const hydrateShadowingItems = (items: any[] = []) => {
  const seedById = new Map(dashboardSeed.shadowingItems.map((item) => [item.id, item]));
  const seedByText = new Map(dashboardSeed.shadowingItems.map((item) => [item.text, item]));

  return items
    .map((item) => {
      const text = typeof item?.text === "string" ? item.text : item?.phrase;
      const fallback = seedById.get(item?.id) ?? seedByText.get(text) ?? undefined;
      const normalized = normalizeShadowingItem(item, fallback);

      if (!normalized?.translation) {
        return null;
      }

      return normalized;
    })
    .filter((item): item is ShadowingItem => Boolean(item));
};

const orderVocabularyForLevel = (items: VocabularyItem[], user: UserProfile, dailyPlan: DailyPlan) => {
  const level = normalizeLevel(user.currentLevel);
  const allowedLevels = allowedReviewLevels(level);
  const rotated = rotateItems(items, dailyProgressionSeed(dailyPlan, user));
  const nearLevel = rotated.filter((item) => allowedLevels.has(normalizeLevel(item.level)));
  const stretch = rotated.filter((item) => !allowedLevels.has(normalizeLevel(item.level)));

  return [...nearLevel, ...stretch].sort((a, b) => {
    const confidenceDelta = (a.confidence ?? 50) - (b.confidence ?? 50);

    if (Math.abs(confidenceDelta) >= 20) {
      return confidenceDelta;
    }

    return levelDistance(level, normalizeLevel(a.level)) - levelDistance(level, normalizeLevel(b.level));
  });
};

const orderListeningForLevel = (items: ListeningLesson[], user: UserProfile, dailyPlan: DailyPlan) => {
  const level = normalizeLevel(user.currentLevel);
  const allowedLevels = allowedReviewLevels(level);
  const rotated = rotateItems(items, dailyProgressionSeed(dailyPlan, user));

  return [
    ...rotated.filter((item) => allowedLevels.has(normalizeLevel(item.level))),
    ...rotated.filter((item) => !allowedLevels.has(normalizeLevel(item.level))),
  ];
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
          source: "global_catalog",
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
      VocabularyItemModel.find({
        $or: [
          { userId },
          { userId: { $exists: false } },
          { userId: null, source: "global_catalog" },
        ],
      }).sort({ userId: -1, createdAt: -1 }),
      ContentCatalogModel.find(),
    ]);
    const byKey = new Map(catalogs.map((catalog) => [catalog.key, catalog.items]));

    return {
      vocabulary: vocabulary.map(toPlainVocabulary),
      listeningLessons: hydrateListeningLessons(byKey.get("listeningLessons") ?? dashboardSeed.listeningLessons),
      shadowingItems: hydrateShadowingItems(byKey.get("shadowingItems") ?? dashboardSeed.shadowingItems),
      conversationModes: byKey.get("conversationModes") ?? [],
      developerModes: byKey.get("developerModes") ?? [],
      thinkInEnglishPrompts: byKey.get("thinkInEnglishPrompts") ?? [],
    };
  }

  personalizeForPlan(
    content: LearningContent,
    user: UserProfile,
    dailyPlan: DailyPlan,
    history: PersonalizationHistory = {}
  ): LearningContent {
    const seed = dailyProgressionSeed(dailyPlan, user);
    const memory = buildTeacherMemory(history);
    const semanticHistory = (module: DailyContentModule) =>
      (history.presentedContent ?? [])
        .filter((item) => item.type === module || (module === "think-in-english" && item.type === "conversation"))
        .map((item) => item.semantic)
        .filter((semantic): semantic is ContentSemanticMetadata => Boolean(semantic));
    const contextFor = (module: DailyContentModule) => selectSemanticContext({
      userId: user.id,
      date: dailyPlan.date,
      level: normalizeLevel(user.currentLevel),
      module,
      recent: semanticHistory(module),
    });
    const vocabularyContext = contextFor("vocabulary");
    const listeningContext = contextFor("listening");
    const shadowingContext = contextFor("shadowing");
    const conversationContext = contextFor("conversation");
    const thinkContext = contextFor("think-in-english");
    const shadowingCandidates = buildPlanShadowingItems(user, dailyPlan, memory);
    const vocabularyCatalog = orderVocabularyForLevel(content.vocabulary, user, dailyPlan);
    const listeningCatalog = orderListeningForLevel(content.listeningLessons, user, dailyPlan);
    const vocabulary = uniqueBy([buildSemanticVocabulary(vocabularyContext, user, dailyPlan), ...buildPlanVocabulary(user, dailyPlan, memory), ...vocabularyCatalog], (item) => item.phrase);
    const listeningLessons = uniqueBy([buildSemanticListeningLesson(listeningContext, user, dailyPlan), buildPlanListeningLesson(user, dailyPlan, memory), ...listeningCatalog], (item) => item.id);
    const selectedShadowing = selectShadowingItems(
      [buildSemanticShadowing(shadowingContext, dailyPlan), ...shadowingCandidates],
      rotateItems(content.shadowingItems, seed),
      dailyPlan,
      history
    );
    const shadowing = uniqueBy(
      [buildSemanticShadowing(shadowingContext, dailyPlan), ...selectedShadowing],
      (item) => item.text
    ).slice(0, 4);

    return {
      vocabulary: orderByEligibility("vocabulary", vocabulary.map((item) => ({ id: item.id, text: item.phrase, item })), history, seed),
      listeningLessons: orderByEligibility("listening", listeningLessons.map((item) => ({
        id: item.id,
        text: item.title,
        aliases: [
          ...item.dialogue.map((line) => contentFingerprint("listening", line.includes(":") ? line.slice(line.indexOf(":") + 1) : line)),
        ],
        item,
      })), history, seed),
      shadowingItems: orderByEligibility("shadowing", shadowing.map((item) => ({ id: item.id, text: item.text, item })), history, seed),
      conversationModes: orderByEligibility("conversation", [buildSemanticConversationMode(conversationContext, dailyPlan), ...rotateItems(content.conversationModes, seed)].map((item) => ({ id: item.id, text: item.starter, item })), history, seed),
      developerModes: orderByEligibility("conversation", rotateItems(content.developerModes, seed).map((item) => ({ id: item.id, text: item.starter, item })), history, seed),
      thinkInEnglishPrompts: orderByEligibility("conversation", [buildSemanticThinkPrompt(thinkContext, dailyPlan), buildPlanThinkPrompt(dailyPlan, user, memory), ...rotateItems(content.thinkInEnglishPrompts, seed)].map((item) => ({ id: item.id, text: item.userMessage, item })), history, seed),
    };
  }

  async getPresentedContent(userId: string) {
    if (mongoose.connection.readyState !== 1) return [];
    const rows = await ContentExposureModel.find({ userId })
      .select("type itemId title semantic lastPresentedAt")
      .lean();
    return rows.map((row) => ({
      id: String(row._id),
      type: row.type,
      itemId: row.itemId,
      title: row.title,
      completedAt: row.lastPresentedAt.toISOString(),
      semantic: row.semantic && row.semantic.topic && row.semantic.subtopic && row.semantic.scenario && row.semantic.communicativeGoal
        ? {
            topic: row.semantic.topic,
            subtopic: row.semantic.subtopic,
            scenario: row.semantic.scenario,
            communicativeGoal: row.semantic.communicativeGoal,
            setting: row.semantic.setting ?? undefined,
            participants: row.semantic.participants ?? [],
            keywords: row.semantic.keywords ?? [],
          }
        : undefined,
    }));
  }

  async recordDailyPresentation(userId: string, content: LearningContent) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(userId)) return;
    const mongoUserId = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    // Record only the leading daily recommendations, not every catalog item
    // delivered for browsing. Bulk upsert keeps this idempotent and avoids N+1.
    const selected = [
      ...content.vocabulary.slice(0, 3).map((item) => ({ type: "vocabulary", itemId: item.id, title: item.phrase, semantic: item.semantic })),
      ...content.listeningLessons.slice(0, 1).map((item) => ({ type: "listening", itemId: item.id, title: item.title, semantic: item.semantic })),
      ...content.shadowingItems.slice(0, 4).map((item) => ({ type: "shadowing", itemId: item.id, title: item.text, semantic: item.semantic })),
      ...content.conversationModes.slice(0, 1).map((item) => ({ type: "conversation", itemId: item.id, title: item.starter, semantic: item.semantic })),
      ...content.developerModes.slice(0, 1).map((item) => ({ type: "conversation", itemId: item.id, title: item.starter, semantic: item.semantic })),
      ...content.thinkInEnglishPrompts.slice(0, 1).map((item) => ({ type: "think-in-english", itemId: item.id, title: item.userMessage, semantic: item.semantic })),
    ];
    if (!selected.length) return;
    await ContentExposureModel.bulkWrite(selected.map((item) => {
      const semantic = item.semantic
        ? { ...item.semantic, participants: item.semantic.participants ?? [], keywords: item.semantic.keywords ?? [] }
        : undefined;
      return ({
      updateOne: {
        filter: { userId: mongoUserId, type: item.type, fingerprint: contentFingerprint(item.type, item.title) },
        update: {
          $set: {
            itemId: item.itemId,
            title: item.title,
            semantic,
            ...(semantic ? { semanticFingerprint: semanticFingerprint(semantic) } : {}),
            lastPresentedAt: now,
          },
          $setOnInsert: { userId: mongoUserId, type: item.type, fingerprint: contentFingerprint(item.type, item.title), firstPresentedAt: now },
        },
        upsert: true,
      },
    });
    }));

    await this.schedulePresentedPhrasesForReview(userId, content);
  }

  /**
   * Seeds the spaced-repetition queue from phrases the learner has actually
   * received in their daily practice. Previously a schedule was only created
   * after a user had completed a review, which left a new learner with an
   * permanently empty review queue.
   */
  private async schedulePresentedPhrasesForReview(userId: string, content: LearningContent) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(userId)) return;

    const now = new Date();
    const candidates = uniqueBy([
      ...content.vocabulary.slice(0, 3).map((item) => ({
        phrase: item.phrase,
        translation: item.translation,
        level: item.level,
        category: item.category,
        sentences: item.sentences,
      })),
      ...content.shadowingItems.slice(0, 4).map((item) => ({
        phrase: item.text,
        translation: item.translation,
        level: "A1" as EnglishLevel,
        category: "Frase praticada",
        sentences: [{ text: item.text, translation: item.translation }],
      })),
    ], (item) => item.phrase).filter((item) => item.phrase.trim() && item.translation?.trim());

    for (const item of candidates) {
      const existing = await VocabularyItemModel.findOne({ userId, phrase: item.phrase }).select("_id").lean();
      if (existing) continue;

      const saved = await VocabularyItemModel.findOneAndUpdate(
        { userId, phrase: item.phrase },
        {
          $setOnInsert: {
            userId,
            phrase: item.phrase,
            translation: item.translation,
            level: item.level,
            category: item.category,
            sentences: item.sentences,
            confidence: 50,
            nextReviewAt: now,
            hits: 0,
            misses: 0,
            source: "spaced_repetition",
            timesPracticed: 0,
            timesCorrect: 0,
            timesWrong: 0,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      await ReviewScheduleModel.findOneAndUpdate(
        { userId, vocabularyItemId: saved._id },
        {
          $setOnInsert: {
            hits: 0,
            misses: 0,
            confidence: 50,
            nextReviewAt: now,
          },
        },
        { upsert: true },
      );
    }
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

  async generateReviewQueue(userId: string) {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(userId)) return [];

    const content = await this.getLearningContent(userId);
    await this.schedulePresentedPhrasesForReview(userId, content);

    const phrases = uniqueBy([
      ...content.vocabulary.slice(0, 3).map((item) => ({ phrase: item.phrase })),
      ...content.shadowingItems.slice(0, 4).map((item) => ({ phrase: item.text })),
    ], (item) => item.phrase).map((item) => item.phrase);
    const reviewItems = await VocabularyItemModel.find({ userId, phrase: { $in: phrases } })
      .sort({ misses: -1, confidence: 1, updatedAt: -1 })
      .limit(7)
      .select("_id");

    if (reviewItems.length > 0) {
      await ReviewScheduleModel.updateMany(
        { userId, vocabularyItemId: { $in: reviewItems.map((item) => item._id) } },
        { $set: { nextReviewAt: new Date() } },
      );
    }

    return this.getDueReviewItems(userId);
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
        source: item.source === "global_catalog" ? "user_reviewed_global" : item.source ?? "user_saved",
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

    const shouldUpdateById = mongoose.Types.ObjectId.isValid(item.id) && item.source !== "global_catalog";
    const saved = shouldUpdateById
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
