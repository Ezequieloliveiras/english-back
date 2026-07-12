import { DailyPlanRepository } from "../repositories/dailyPlan.repository";
import { learningUnits } from "../data/learningRoadmap";
import {
  DailyPlanStep,
  DailyPlan,
  EnglishLevel,
  StudyBlock,
  StudyBlockType,
  StudyStatus,
  UserProfile,
} from "../types";

const todayKey = () => new Date().toISOString().slice(0, 10);

const blockTemplates: Record<StudyBlockType, Omit<StudyBlock, "id" | "durationMinutes" | "status" | "progress">> = {
  shadowing: {
    title: "Shadowing",
    type: "shadowing",
    objective: "Repeat useful phrases with rhythm, stress, and confidence.",
  },
  "speaking-coach": {
    title: "Speaking Coach",
    type: "speaking-coach",
    objective: "Record your voice and get phonetic feedback on natural spoken English.",
  },
  listening: {
    title: "Listening",
    type: "listening",
    objective: "Understand short, comprehensible dialogues without translating every word.",
  },
  vocabulary: {
    title: "Vocabulary",
    type: "vocabulary",
    objective: "Review complete sentences you can reuse in real situations.",
  },
  conversation: {
    title: "Conversation",
    type: "conversation",
    objective: "Practice answering naturally with simple, fluent sentences.",
  },
  review: {
    title: "Review",
    type: "review",
    objective: "Revisit weak phrases using active recall and spaced repetition.",
  },
};

const blockTypeOrder = Object.keys(blockTemplates) as StudyBlockType[];

const requiredStepTemplates: Record<StudyBlockType, Array<{ id: string; label: string }>> = {
  listening: [
    { id: "listen-required-lines", label: "Ouvir as falas obrigatórias" },
    { id: "answer-comprehension", label: "Responder à compreensão" },
    { id: "complete-required-lines", label: "Concluir as falas exigidas" },
    { id: "finish-conversation", label: "Finalizar a conversa" },
  ],
  shadowing: [
    { id: "play-phrase", label: "Reproduzir a frase" },
    { id: "repeat-phrase", label: "Repetir com ritmo" },
    { id: "finish-required-phrases", label: "Finalizar as frases do bloco" },
  ],
  "speaking-coach": [
    { id: "record-required-phrase", label: "Realizar a gravação obrigatória" },
    { id: "receive-analysis", label: "Receber análise de pronúncia" },
    { id: "register-result", label: "Registrar o resultado da frase" },
  ],
  conversation: [
    { id: "start-conversation", label: "Iniciar a conversa" },
    { id: "answer-required-steps", label: "Responder às etapas obrigatórias" },
    { id: "finish-communicative-goal", label: "Concluir o objetivo comunicativo" },
  ],
  vocabulary: [
    { id: "review-planned-items", label: "Revisar os itens previstos" },
    { id: "answer-required-exercises", label: "Responder aos exercícios obrigatórios" },
    { id: "complete-active-recall", label: "Concluir recall ou uso ativo" },
  ],
  review: [
    { id: "finish-due-items", label: "Finalizar os itens vencidos" },
    { id: "register-review-result", label: "Registrar o resultado da revisão" },
  ],
};

const buildRequiredSteps = (type: StudyBlockType): DailyPlanStep[] =>
  requiredStepTemplates[type].map((step) => ({
    ...step,
    status: "not_started",
    required: true,
    completedAt: null,
  }));

const evidenceToSteps: Record<StudyBlockType, Record<string, string[]>> = {
  listening: {
    listening_attempt: ["listen-required-lines", "answer-comprehension"],
    listening_completion: ["complete-required-lines", "finish-conversation"],
  },
  shadowing: {
    practice_completion: ["play-phrase", "repeat-phrase", "finish-required-phrases"],
  },
  "speaking-coach": {
    pronunciation_analysis: ["record-required-phrase", "receive-analysis", "register-result"],
    practice_completion: ["record-required-phrase", "receive-analysis", "register-result"],
  },
  conversation: {
    conversation_task: ["start-conversation", "answer-required-steps", "finish-communicative-goal"],
    practice_completion: ["start-conversation", "answer-required-steps", "finish-communicative-goal"],
  },
  vocabulary: {
    vocabulary_recall: ["review-planned-items", "answer-required-exercises", "complete-active-recall"],
    practice_completion: ["review-planned-items", "answer-required-exercises", "complete-active-recall"],
  },
  review: {
    retention_review: ["finish-due-items", "register-review-result"],
    practice_completion: ["finish-due-items", "register-review-result"],
  },
};

const normalizeBlockStatus = (status?: string): StudyStatus =>
  status === "pending" ? "not_started" : (status as StudyStatus) ?? "not_started";

const calculateBlockProgress = (block: StudyBlock): StudyBlock => {
  const requiredSteps = block.requiredSteps?.length ? block.requiredSteps : buildRequiredSteps(block.type);
  const totalSteps = requiredSteps.filter((step) => step.required).length;
  const completedSteps = requiredSteps.filter((step) => step.required && step.status === "completed").length;
  const progressPercentage = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
  const status = progressPercentage === 100
    ? "completed"
    : progressPercentage > 0
      ? "in_progress"
      : normalizeBlockStatus(block.status) === "blocked" || normalizeBlockStatus(block.status) === "review_pending"
        ? normalizeBlockStatus(block.status)
        : "not_started";

  return {
    ...block,
    requiredSteps,
    totalSteps,
    completedSteps,
    progress: progressPercentage,
    progressPercentage,
    status,
    startedAt: block.startedAt ?? (progressPercentage > 0 ? new Date().toISOString() : null),
    completedAt: status === "completed" ? block.completedAt ?? new Date().toISOString() : null,
  };
};

const calculatePlanStatus = (plan: DailyPlan): Pick<DailyPlan, "status" | "completedAt"> => {
  const completedBlocks = plan.blocks.filter((block) => block.status === "completed").length;

  if (plan.blocks.length > 0 && completedBlocks === plan.blocks.length) {
    return { status: "completed", completedAt: plan.completedAt ?? new Date().toISOString() };
  }

  if (plan.blocks.some((block) => block.status === "in_progress" || block.status === "completed")) {
    return { status: "in_progress", completedAt: null };
  }

  return { status: "not_started", completedAt: null };
};

const baseWeights: Record<StudyBlockType, number> = {
  shadowing: 0.22,
  "speaking-coach": 0.16,
  listening: 0.2,
  vocabulary: 0.13,
  conversation: 0.21,
  review: 0.08,
};

const difficultyBoost: Record<UserProfile["mainDifficulty"], Partial<Record<StudyBlockType, number>>> = {
  speaking: { conversation: 0.1, "speaking-coach": 0.08, shadowing: 0.05, listening: -0.04, vocabulary: -0.03 },
  listening: { listening: 0.14, shadowing: 0.03, conversation: -0.04, vocabulary: -0.03 },
  vocabulary: { vocabulary: 0.14, review: 0.05, conversation: -0.04, shadowing: -0.03 },
  pronunciation: { "speaking-coach": 0.12, shadowing: 0.1, conversation: 0.04, vocabulary: -0.04, review: -0.02 },
};

const levelBoost: Partial<Record<EnglishLevel, Partial<Record<StudyBlockType, number>>>> = {
  A1: { listening: 0.07, vocabulary: 0.05, conversation: -0.05 },
  A2: { shadowing: 0.04, "speaking-coach": 0.03, conversation: 0.03 },
  B1: { conversation: 0.07, review: 0.02, listening: -0.03 },
  B2: { conversation: 0.1, review: 0.03, vocabulary: -0.04 },
  C1: { conversation: 0.12, review: 0.04, listening: -0.04 },
};

const normalizeLevel = (level: string): EnglishLevel => {
  const value = level.toUpperCase();
  if (["A1.1", "A1.2", "A2.1", "A2.2", "B1.1", "B1.2", "B2.1", "B2.2"].includes(value)) {
    return value as EnglishLevel;
  }

  return ["A1", "A2", "B1", "B2", "C1"].includes(value) ? (value as EnglishLevel) : "A1.1";
};

const normalizeDifficulty = (difficulty: string): UserProfile["mainDifficulty"] => {
  if (["listening", "speaking", "vocabulary", "pronunciation"].includes(difficulty)) {
    return difficulty as UserProfile["mainDifficulty"];
  }

  return "speaking";
};

const goalBoost = (goal: string): Partial<Record<StudyBlockType, number>> => {
  const normalized = goal.toLowerCase();

  if (normalized.includes("meeting") || normalized.includes("speak") || normalized.includes("conversation")) {
    return { conversation: 0.08, "speaking-coach": 0.04, shadowing: 0.03 };
  }

  if (normalized.includes("listen") || normalized.includes("understand")) {
    return { listening: 0.08, vocabulary: 0.02 };
  }

  if (normalized.includes("interview") || normalized.includes("job")) {
    return { conversation: 0.07, review: 0.03 };
  }

  if (normalized.includes("developer") || normalized.includes("technical") || normalized.includes("work")) {
    return { conversation: 0.05, vocabulary: 0.04, review: 0.02 };
  }

  return {};
};

const buildFocus = (profile: UserProfile) => {
  const focusByDifficulty: Record<UserProfile["mainDifficulty"], string> = {
    speaking: "Build speaking confidence with short, realistic conversations.",
    listening: "Train your ear with short, comprehensible input before output.",
    vocabulary: "Turn sentence mining into phrases you can reuse today.",
    pronunciation: "Improve clarity with shadowing and controlled repetition.",
  };

  return `${focusByDifficulty[profile.mainDifficulty]} Goal: ${profile.primaryGoal}`;
};

const levelBand = (level: EnglishLevel) => level.slice(0, 2);

const selectLearningUnit = (level: EnglishLevel, rotation: number) => {
  const exact = learningUnits.filter((unit) => unit.level === level && unit.status === "published");
  const byBand = learningUnits.filter((unit) => unit.level.startsWith(levelBand(level)) && unit.status === "published");
  const available = exact.length ? exact : byBand.length ? byBand : learningUnits.filter((unit) => unit.status === "published");

  if (!available.length) {
    return null;
  }

  return available[Math.abs(rotation) % available.length];
};

const distributeMinutes = (totalMinutes: number, weights: Record<StudyBlockType, number>) => {
  const blockTypes = Object.keys(weights) as StudyBlockType[];
  const safeTotal = Math.max(10, Math.min(120, Math.round(totalMinutes)));
  const normalizedTotal = blockTypes.reduce((sum, type) => sum + Math.max(0.04, weights[type]), 0);
  const preferredMinimum = safeTotal < 20 ? 3 : 4;
  const minimum = Math.max(1, Math.min(preferredMinimum, Math.floor(safeTotal / blockTypes.length)));

  let allocations = blockTypes.map((type) => ({
    type,
    minutes: Math.max(minimum, Math.round((Math.max(0.04, weights[type]) / normalizedTotal) * safeTotal)),
  }));

  let difference = safeTotal - allocations.reduce((sum, block) => sum + block.minutes, 0);
  const sorted = [...allocations].sort((a, b) => weights[b.type] - weights[a.type]);

  while (difference !== 0) {
    for (const block of sorted) {
      if (difference === 0) {
        break;
      }

      const target = allocations.find((entry) => entry.type === block.type);

      if (!target) {
        continue;
      }

      if (difference > 0) {
        target.minutes += 1;
        difference -= 1;
      } else if (target.minutes > minimum) {
        target.minutes -= 1;
        difference += 1;
      }
    }
  }

  return allocations;
};

const applyBoost = (
  weights: Record<StudyBlockType, number>,
  boost: Partial<Record<StudyBlockType, number>>
) => {
  const next = { ...weights };

  for (const [type, value] of Object.entries(boost) as Array<[StudyBlockType, number]>) {
    next[type] = Math.max(0.04, next[type] + value);
  }

  return next;
};

export class DailyPlanService {
  constructor(private readonly dailyPlanRepository: DailyPlanRepository) {}

  generatePlan(profile: UserProfile, date = todayKey(), rotation = 0): Omit<DailyPlan, "id"> {
    const level = normalizeLevel(profile.currentLevel);
    const difficulty = normalizeDifficulty(profile.mainDifficulty);
    const learningUnit = selectLearningUnit(level, rotation);
    let weights = { ...baseWeights };

    weights = applyBoost(weights, difficultyBoost[difficulty]);
    weights = applyBoost(weights, levelBoost[level] ?? levelBoost[levelBand(level) as EnglishLevel] ?? {});
    weights = applyBoost(weights, goalBoost(profile.primaryGoal));

    const allocations = distributeMinutes(profile.dailyMinutes, weights);
    const rotationIndex = allocations.length ? Math.abs(rotation) % allocations.length : 0;
    const orderedAllocations = [
      ...allocations.slice(rotationIndex),
      ...allocations.slice(0, rotationIndex),
    ];
    const blocks = orderedAllocations.map(({ type, minutes }, index) => ({
      id: `${date}-${type}-${index + 1}`,
      ...blockTemplates[type],
      durationMinutes: minutes,
      status: "not_started" as const,
      progress: 0,
      requiredSteps: buildRequiredSteps(type),
      completedSteps: 0,
      totalSteps: requiredStepTemplates[type].length,
      progressPercentage: 0,
      startedAt: null,
      completedAt: null,
    }));

    return {
      userId: profile.id,
      focus: learningUnit
        ? `${learningUnit.title}: ${learningUnit.scenario}`
        : buildFocus({ ...profile, currentLevel: level, mainDifficulty: difficulty }),
      totalMinutes: blocks.reduce((sum, block) => sum + block.durationMinutes, 0),
      streak: 0,
      date,
      status: "not_started",
      completedAt: null,
      learningUnitId: learningUnit?.id,
      scenario: learningUnit?.scenario,
      targetCompetencies: learningUnit?.competencies ?? [],
      targetChunks: learningUnit?.vocabularyChunks ?? [],
      blocks,
    };
  }

  private normalizePlan(plan: DailyPlan) {
    const blocks = plan.blocks.map((block) => calculateBlockProgress(block));
    const planStatus = calculatePlanStatus({ ...plan, blocks });

    return {
      ...plan,
      ...planStatus,
      blocks,
    };
  }

  private async persistNormalizedPlan(plan: DailyPlan) {
    const normalized = this.normalizePlan(plan);
    const needsPersistence = JSON.stringify(normalized) !== JSON.stringify(plan);

    if (!needsPersistence) {
      return normalized;
    }

    return (await this.dailyPlanRepository.updatePlanBlocks(normalized)) ?? normalized;
  }

  async createOrGetTodayPlan(userId: string) {
    const resolvedUser = await this.dailyPlanRepository.findUserById(userId);

    if (!resolvedUser) {
      throw new Error("User not found");
    }

    const date = todayKey();
    const existingPlan = await this.dailyPlanRepository.findPlanByUserAndDate(resolvedUser.id, date);
    const progress = await this.dailyPlanRepository.findOrCreateProgress(resolvedUser);

    if (existingPlan) {
      const normalizedPlan = await this.persistNormalizedPlan(existingPlan);
      return { user: resolvedUser, dailyPlan: normalizedPlan, progress };
    }

    const plan = await this.dailyPlanRepository.savePlan({
      ...this.generatePlan(resolvedUser, date),
      streak: progress.streakDays,
    });

    return { user: resolvedUser, dailyPlan: plan, progress };
  }

  async createPlanForProfile(userId: string, profile: Partial<UserProfile>) {
    const user = await this.dailyPlanRepository.updateUserProfile(userId, profile);

    if (!user) {
      throw new Error("User not found");
    }

    const progress = await this.dailyPlanRepository.findOrCreateProgress(user);
    const plan = await this.dailyPlanRepository.savePlan({
      ...this.generatePlan(user),
      streak: progress.streakDays,
    });

    return { user, dailyPlan: plan, progress };
  }

  async advanceTodayPlan(userId: string) {
    const resolvedUser = await this.dailyPlanRepository.findUserById(userId);

    if (!resolvedUser) {
      throw new Error("User not found");
    }

    const date = todayKey();
    const existingPlan = await this.dailyPlanRepository.findPlanByUserAndDate(resolvedUser.id, date);
    const progress = await this.dailyPlanRepository.findOrCreateProgress(resolvedUser);
    const currentFirstType = existingPlan?.blocks[0]?.type;
    const currentIndex = currentFirstType ? blockTypeOrder.indexOf(currentFirstType) : -1;
    const rotation = currentIndex >= 0 ? currentIndex + 1 : 1;
    const plan = await this.dailyPlanRepository.savePlan({
      ...this.generatePlan(resolvedUser, date, rotation),
      streak: progress.streakDays,
    });

    return { user: resolvedUser, dailyPlan: plan, progress };
  }

  async completeBlock(planId: string, blockId: string, userId: string) {
    const { user, dailyPlan, progress } = await this.createOrGetTodayPlan(userId);
    const plan = dailyPlan.id === planId ? dailyPlan : null;

    if (!plan) {
      return null;
    }

    const block = plan.blocks.find((entry) => entry.id === blockId);

    if (!block) {
      return null;
    }

    const normalizedPlan = await this.persistNormalizedPlan(plan);

    return { user, dailyPlan: normalizedPlan, progress };
  }

  async recordBlockEvidence(input: {
    userId: string;
    blockType: StudyBlockType;
    evidenceType: string;
    evidenceRef?: string;
  }) {
    const { user, dailyPlan, progress } = await this.createOrGetTodayPlan(input.userId);
    const plan = await this.persistNormalizedPlan(dailyPlan);
    const block = plan.blocks.find((entry) => entry.type === input.blockType && entry.status !== "completed")
      ?? plan.blocks.find((entry) => entry.type === input.blockType);

    if (!block) {
      return { user, dailyPlan: plan, progress };
    }

    const stepIds = evidenceToSteps[input.blockType][input.evidenceType] ?? [];

    if (stepIds.length === 0) {
      return { user, dailyPlan: plan, progress };
    }

    const completedAt = new Date().toISOString();
    const updatedBlock = calculateBlockProgress({
      ...block,
      requiredSteps: (block.requiredSteps ?? buildRequiredSteps(block.type)).map((step) =>
        stepIds.includes(step.id) && step.status !== "completed"
          ? {
              ...step,
              status: "completed",
              completedAt,
              evidenceType: input.evidenceType,
              evidenceRef: input.evidenceRef,
            }
          : step
      ),
      startedAt: block.startedAt ?? completedAt,
    });

    if (
      updatedBlock.completedSteps === block.completedSteps &&
      updatedBlock.progressPercentage === block.progressPercentage &&
      updatedBlock.status === block.status
    ) {
      return { user, dailyPlan: plan, progress };
    }

    const wasCompleted = block.status === "completed";
    const wasPlanCompleted = plan.status === "completed";
    const updatedBlocks = plan.blocks.map((entry) => (entry.id === block.id ? updatedBlock : entry));
    const planStatus = calculatePlanStatus({ ...plan, blocks: updatedBlocks });
    const completedPlanNow = !wasPlanCompleted && planStatus.status === "completed";
    const nextStreakDays = completedPlanNow ? progress.streakDays + 1 : progress.streakDays;
    const updatedPlan = await this.dailyPlanRepository.updatePlanBlocks({
      ...plan,
      ...planStatus,
      streak: nextStreakDays,
      blocks: updatedBlocks,
    });

    const studiedMinutesToday = wasCompleted
      ? progress.studiedMinutesToday
      : updatedBlock.status === "completed"
        ? progress.studiedMinutesToday + block.durationMinutes
        : progress.studiedMinutesToday;
    const completedBlocks = updatedBlocks.filter((entry) => entry.status === "completed").length;
    const consistencyScore = Math.min(
      100,
      Math.round((completedBlocks / updatedBlocks.length) * 100)
    );
    const updatedProgress = await this.dailyPlanRepository.saveProgress(user.id, {
      ...progress,
      studiedMinutesToday,
      streakDays: nextStreakDays,
      consistencyScore: Math.max(progress.consistencyScore, consistencyScore),
    });

    return { user, dailyPlan: updatedPlan ?? plan, progress: updatedProgress };
  }
}
