"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPlanService = void 0;
const todayKey = () => new Date().toISOString().slice(0, 10);
const numericDateSeed = (date) => date.split("-").reduce((sum, part) => sum + Number(part), 0);
const blockTemplates = {
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
        title: "Review",
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
const blockTypeOrder = Object.keys(blockTemplates);
const requiredStepTemplates = {
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
const buildRequiredSteps = (type) => requiredStepTemplates[type].map((step) => ({
    ...step,
    status: "not_started",
    required: true,
    completedAt: null,
}));
const evidenceToSteps = {
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
const normalizeBlockStatus = (status) => status === "pending" ? "not_started" : status ?? "not_started";
const calculateBlockProgress = (block) => {
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
const calculatePlanStatus = (plan) => {
    const completedBlocks = plan.blocks.filter((block) => block.status === "completed").length;
    if (plan.blocks.length > 0 && completedBlocks === plan.blocks.length) {
        return { status: "completed", completedAt: plan.completedAt ?? new Date().toISOString() };
    }
    if (plan.blocks.some((block) => block.status === "in_progress" || block.status === "completed")) {
        return { status: "in_progress", completedAt: null };
    }
    return { status: "not_started", completedAt: null };
};
const baseWeights = {
    shadowing: 0.22,
    "speaking-coach": 0.16,
    listening: 0.22,
    vocabulary: 0,
    conversation: 0.24,
    review: 0.16,
};
const difficultyBoost = {
    speaking: { conversation: 0.1, "speaking-coach": 0.08, shadowing: 0.05, listening: -0.04 },
    listening: { listening: 0.14, shadowing: 0.03, conversation: -0.04 },
    vocabulary: { review: 0.12, listening: 0.04 },
    pronunciation: { "speaking-coach": 0.12, shadowing: 0.1, conversation: 0.04, review: -0.02 },
};
const levelBoost = {
    A1: { listening: 0.07, review: 0.05, conversation: -0.05 },
    A2: { shadowing: 0.04, "speaking-coach": 0.03, conversation: 0.03 },
    B1: { conversation: 0.07, review: 0.02, listening: -0.03 },
    B2: { conversation: 0.1, review: 0.03 },
    C1: { conversation: 0.12, review: 0.04, listening: -0.04 },
};
const normalizeLevel = (level) => {
    const value = level.toUpperCase();
    return ["A1", "A2", "B1", "B2", "C1"].includes(value) ? value : "A1";
};
const normalizeDifficulty = (difficulty) => {
    if (["listening", "speaking", "pronunciation"].includes(difficulty)) {
        return difficulty;
    }
    return "speaking";
};
const goalBoost = (goal) => {
    const normalized = goal.toLowerCase();
    if (normalized.includes("meeting") || normalized.includes("speak") || normalized.includes("conversation")) {
        return { conversation: 0.08, "speaking-coach": 0.04, shadowing: 0.03 };
    }
    if (normalized.includes("listen") || normalized.includes("understand")) {
        return { listening: 0.08, review: 0.02 };
    }
    if (normalized.includes("interview") || normalized.includes("job")) {
        return { conversation: 0.07, review: 0.03 };
    }
    if (normalized.includes("developer") || normalized.includes("technical") || normalized.includes("work")) {
        return { conversation: 0.05, review: 0.05 };
    }
    return {};
};
const professionBoost = (profile) => {
    if (profile.professionalFocusMode !== "profession") {
        return {};
    }
    return {
        conversation: 0.08,
        listening: 0.04,
        shadowing: 0.03,
        review: 0.06,
    };
};
const buildProfessionalObjective = (block, profession) => {
    const area = profession.trim() || "sua profissão";
    const objectives = {
        shadowing: `Repeat phrases used in ${area} conversations with natural rhythm.`,
        "speaking-coach": `Practice clear pronunciation for ${area} updates, explanations, and decisions.`,
        listening: `Understand short workplace dialogues from the ${area} context.`,
        vocabulary: `Review complete sentences, terms, and situations from ${area}.`,
        conversation: `Practice realistic ${area} conversations, questions, and follow-ups.`,
        review: `Revisit weak phrases from your ${area} practice cycle.`,
    };
    return objectives[block];
};
const levelFocus = {
    A1: "A1 core: short sentences, useful questions, and clear answers.",
    A2: "A2 bridge: past actions, future plans, polite requests, and short reasons.",
    B1: "B1 expansion: reasons, tradeoffs, conditionals, and follow-up questions.",
    B2: "B2 precision: nuance, prioritization, constraints, and clearer explanations.",
    C1: "C1 polish: concise recommendations, synthesis, hedging, and professional tone.",
};
const buildFocus = (profile) => {
    const level = normalizeLevel(profile.currentLevel);
    if (profile.professionalFocusMode === "profession") {
        return `${levelFocus[level]} Professional focus: English for ${profile.profession}. Goal: ${profile.primaryGoal}`;
    }
    const focusByDifficulty = {
        speaking: "Build speaking confidence with short, realistic conversations.",
        listening: "Train your ear with short, comprehensible input before output.",
        vocabulary: "Strengthen recall with complete phrases you can reuse today.",
        pronunciation: "Improve clarity with shadowing and controlled repetition.",
    };
    return `${levelFocus[level]} ${focusByDifficulty[profile.mainDifficulty]} Goal: ${profile.primaryGoal}`;
};
const levelBand = (level) => level;
const normalizeProfileText = (value) => value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const profileSignature = (profile) => {
    const level = normalizeLevel(profile.currentLevel);
    const difficulty = normalizeDifficulty(profile.mainDifficulty);
    return [
        `level=${level}`,
        `difficulty=${difficulty}`,
        `minutes=${Math.max(10, Math.min(120, Math.round(profile.dailyMinutes)))}`,
        `goal=${normalizeProfileText(profile.primaryGoal)}`,
        `professionMode=${profile.professionalFocusMode ?? "standard"}`,
        `profession=${normalizeProfileText(profile.profession)}`,
    ].join("|");
};
const planMatchesProfile = (plan, profile) => plan.generationReason?.includes(`Profile snapshot: ${profileSignature(profile)}`);
const planHasUserProgress = (plan) => plan.status === "in_progress" ||
    plan.status === "completed" ||
    plan.blocks.some((block) => {
        const progress = block.progressPercentage ?? block.progress ?? 0;
        return (progress > 0 ||
            block.status === "in_progress" ||
            block.status === "completed" ||
            Boolean(block.startedAt) ||
            (block.completedSteps ?? 0) > 0 ||
            (block.requiredSteps ?? []).some((step) => step.status === "completed"));
    });
const dailyRotation = (date, progress) => numericDateSeed(date) + (progress?.completedPlans ?? 0) + (progress?.streakDays ?? 0);
const distributeMinutes = (totalMinutes, weights) => {
    const blockTypes = Object.keys(weights).filter((type) => type !== "vocabulary");
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
            }
            else if (target.minutes > minimum) {
                target.minutes -= 1;
                difference += 1;
            }
        }
    }
    return allocations;
};
const applyBoost = (weights, boost) => {
    const next = { ...weights };
    for (const [type, value] of Object.entries(boost)) {
        next[type] = Math.max(0.04, next[type] + value);
    }
    return next;
};
const weakestSkillBoost = (progress) => {
    if (!progress) {
        return { boost: {} };
    }
    const scores = [
        { skill: "listening", score: progress.listeningScore, boost: { listening: 0.08, shadowing: 0.03 } },
        { skill: "speaking", score: progress.speakingScore, boost: { conversation: 0.07, "speaking-coach": 0.04 } },
        { skill: "review", score: progress.vocabularyScore, boost: { review: 0.1, listening: 0.02 } },
        { skill: "pronunciation", score: progress.pronunciationScore, boost: { "speaking-coach": 0.08, shadowing: 0.05 } },
    ];
    const meaningful = scores.filter((entry) => entry.score > 0);
    if (!meaningful.length) {
        return { boost: {}, reason: "No skill history yet; used onboarding profile only." };
    }
    const weakest = [...meaningful].sort((a, b) => a.score - b.score)[0];
    return {
        boost: weakest.boost,
        reason: `Added extra ${weakest.skill} weight because it is the weakest recent skill (${weakest.score}/100).`,
    };
};
class DailyPlanService {
    constructor(dailyPlanRepository, progressService) {
        this.dailyPlanRepository = dailyPlanRepository;
        this.progressService = progressService;
    }
    generatePlan(profile, date = todayKey(), rotation = 0, context = {}) {
        const level = normalizeLevel(profile.currentLevel);
        const difficulty = normalizeDifficulty(profile.mainDifficulty);
        let weights = { ...baseWeights };
        const weakSkill = weakestSkillBoost(context.progress);
        weights = applyBoost(weights, difficultyBoost[difficulty]);
        weights = applyBoost(weights, levelBoost[level] ?? levelBoost[levelBand(level)] ?? {});
        weights = applyBoost(weights, goalBoost(profile.primaryGoal));
        weights = applyBoost(weights, professionBoost(profile));
        weights = applyBoost(weights, weakSkill.boost);
        const allocations = distributeMinutes(profile.dailyMinutes, weights);
        const rotationIndex = allocations.length ? Math.abs(rotation) % allocations.length : 0;
        const orderedAllocations = [
            ...allocations.slice(rotationIndex),
            ...allocations.slice(0, rotationIndex),
        ];
        const blocks = orderedAllocations.map(({ type, minutes }, index) => ({
            id: `${date}-${type}-${index + 1}`,
            ...blockTemplates[type],
            objective: profile.professionalFocusMode === "profession"
                ? buildProfessionalObjective(type, profile.profession)
                : blockTemplates[type].objective,
            durationMinutes: minutes,
            status: "not_started",
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
            focus: buildFocus({ ...profile, currentLevel: level, mainDifficulty: difficulty }),
            totalMinutes: blocks.reduce((sum, block) => sum + block.durationMinutes, 0),
            streak: 0,
            date,
            status: "not_started",
            completedAt: null,
            generationMethod: "heuristic",
            generationReason: [
                `Generated deterministically from level ${level}, difficulty ${difficulty}, daily minutes, goal and professional context.`,
                `Profile snapshot: ${profileSignature({ ...profile, currentLevel: level, mainDifficulty: difficulty })}.`,
                weakSkill.reason,
            ].filter(Boolean).join(" "),
            blocks,
        };
    }
    normalizePlan(plan) {
        const blocks = plan.blocks
            .filter((block) => block.type !== "vocabulary")
            .map((block) => calculateBlockProgress(block));
        const planStatus = calculatePlanStatus({ ...plan, blocks });
        return {
            ...plan,
            ...planStatus,
            totalMinutes: blocks.reduce((sum, block) => sum + block.durationMinutes, 0),
            blocks,
        };
    }
    async persistNormalizedPlan(plan) {
        const normalized = this.normalizePlan(plan);
        const needsPersistence = JSON.stringify(normalized) !== JSON.stringify(plan);
        if (!needsPersistence) {
            return normalized;
        }
        return (await this.dailyPlanRepository.updatePlanBlocks(normalized)) ?? normalized;
    }
    async createOrGetTodayPlan(userId) {
        const resolvedUser = await this.dailyPlanRepository.findUserById(userId);
        if (!resolvedUser) {
            throw new Error("User not found");
        }
        const date = todayKey();
        const existingPlan = await this.dailyPlanRepository.findPlanByUserAndDate(resolvedUser.id, date);
        const progress = await this.dailyPlanRepository.findOrCreateProgress(resolvedUser);
        if (existingPlan) {
            if (!planMatchesProfile(existingPlan, resolvedUser) && !planHasUserProgress(existingPlan)) {
                const refreshedPlan = await this.dailyPlanRepository.savePlan({
                    ...this.generatePlan(resolvedUser, date, dailyRotation(date, progress), { progress }),
                    streak: progress.streakDays,
                });
                return { user: resolvedUser, dailyPlan: refreshedPlan, progress };
            }
            const normalizedPlan = await this.persistNormalizedPlan(existingPlan);
            return { user: resolvedUser, dailyPlan: await this.ensureUniqueAiActivityIds(normalizedPlan), progress };
        }
        const plan = await this.dailyPlanRepository.savePlan({
            ...this.generatePlan(resolvedUser, date, dailyRotation(date, progress), { progress }),
            streak: progress.streakDays,
        });
        return { user: resolvedUser, dailyPlan: plan, progress };
    }
    async createPlanForProfile(userId, profile) {
        const user = await this.dailyPlanRepository.updateUserProfile(userId, profile);
        if (!user) {
            throw new Error("User not found");
        }
        const progress = await this.dailyPlanRepository.findOrCreateProgress(user);
        const plan = await this.dailyPlanRepository.savePlan({
            ...this.generatePlan(user, todayKey(), dailyRotation(todayKey(), progress), { progress }),
            streak: progress.streakDays,
        });
        return { user, dailyPlan: plan, progress };
    }
    async updateProfile(userId, profile) {
        const user = await this.dailyPlanRepository.updateUserProfile(userId, profile);
        if (!user) {
            throw new Error("User not found");
        }
        return user;
    }
    async saveAiBlueprint(plan, blueprint) {
        return (await this.dailyPlanRepository.updateAiBlueprint(plan.id, blueprint)) ?? { ...plan, aiBlueprint: blueprint };
    }
    async markAiActivityCompleted(userId, itemId, practiceType) {
        const { dailyPlan } = await this.createOrGetTodayPlan(userId);
        const blueprint = dailyPlan.aiBlueprint;
        if (!blueprint)
            return dailyPlan;
        const module = practiceType === "speaking-coach" || practiceType === "pronunciation" ? "pronunciation" : practiceType;
        const activity = blueprint.activities.find((entry) => entry.module === module && (itemId === entry.id || itemId.startsWith(`${entry.id}-`)));
        if (!activity || activity.status === "completed")
            return dailyPlan;
        const next = structuredClone(blueprint);
        const target = next.activities.find((entry) => entry.id === activity.id);
        target.status = "completed";
        return this.saveAiBlueprint(dailyPlan, next);
    }
    async ensureUniqueAiActivityIds(plan) {
        const blueprint = plan.aiBlueprint;
        if (!blueprint || blueprint.activities.every((activity) => activity.id.startsWith(`${plan.id}:`)))
            return plan;
        const next = structuredClone(blueprint);
        next.activities = next.activities.map((activity) => ({
            ...activity,
            id: activity.id.startsWith(`${plan.id}:`) ? activity.id : `${plan.id}:${activity.id}`,
            // A legacy generated payload was tied to the old identity. Regenerate it
            // lazily under the new, plan-specific identity instead of inheriting it.
            generatedContent: undefined,
            status: activity.status === "completed" ? "planned" : activity.status === "ready" ? "planned" : activity.status,
        }));
        return this.saveAiBlueprint(plan, next);
    }
    async advanceTodayPlan(userId) {
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
            ...this.generatePlan(resolvedUser, date, rotation, { progress }),
            streak: progress.streakDays,
        });
        return { user: resolvedUser, dailyPlan: plan, progress };
    }
    async completeBlock(planId, blockId, userId) {
        const { user, dailyPlan, progress } = await this.createOrGetTodayPlan(userId);
        const plan = dailyPlan.id === planId ? dailyPlan : null;
        if (!plan) {
            return { status: 404, body: { message: "Study block not found" } };
        }
        const block = plan.blocks.find((entry) => entry.id === blockId);
        if (!block) {
            return { status: 404, body: { message: "Study block not found" } };
        }
        if (block.status === "completed") {
            return {
                status: 200,
                body: { user, dailyPlan: plan, progress, alreadyCompleted: true },
            };
        }
        if (block.type === "speaking-coach") {
            return {
                status: 409,
                body: {
                    message: "Speaking Coach blocks require a real pronunciation analysis before completion.",
                    requiredEvidenceType: "pronunciation_analysis",
                },
            };
        }
        const completedAt = new Date().toISOString();
        const updatedBlock = calculateBlockProgress({
            ...block,
            requiredSteps: (block.requiredSteps ?? buildRequiredSteps(block.type)).map((step) => ({
                ...step,
                status: "completed",
                completedAt: step.completedAt ?? completedAt,
                evidenceType: step.evidenceType ?? "manual_completion",
                evidenceRef: step.evidenceRef ?? block.id,
            })),
            startedAt: block.startedAt ?? completedAt,
            completedAt,
        });
        const wasPlanCompleted = plan.status === "completed";
        const updatedBlocks = plan.blocks.map((entry) => (entry.id === block.id ? updatedBlock : entry));
        const planStatus = calculatePlanStatus({ ...plan, blocks: updatedBlocks });
        const completedPlanNow = !wasPlanCompleted && planStatus.status === "completed";
        const progressAfterCompletion = this.progressService
            ? await this.progressService.recordBlockCompleted({
                userId: user.id,
                plan: { ...plan, ...planStatus, blocks: updatedBlocks },
                block: updatedBlock,
                previousProgress: progress,
                completedPlanNow,
            })
            : await this.dailyPlanRepository.saveProgress(user.id, {
                ...progress,
                studiedMinutesToday: progress.studiedMinutesToday + block.durationMinutes,
                streakDays: completedPlanNow ? progress.streakDays + 1 : progress.streakDays,
                consistencyScore: Math.max(progress.consistencyScore, Math.round((updatedBlocks.filter((entry) => entry.status === "completed").length / updatedBlocks.length) * 100)),
                completedBlocks: (progress.completedBlocks ?? 0) + 1,
                completedPlans: (progress.completedPlans ?? 0) + (completedPlanNow ? 1 : 0),
            });
        const updatedPlan = await this.dailyPlanRepository.updatePlanBlocks({
            ...plan,
            ...planStatus,
            streak: progressAfterCompletion.streakDays,
            blocks: updatedBlocks,
        });
        return {
            status: 200,
            body: { user, dailyPlan: updatedPlan ?? plan, progress: progressAfterCompletion, alreadyCompleted: false },
        };
    }
    async recordBlockEvidence(input) {
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
            requiredSteps: (block.requiredSteps ?? buildRequiredSteps(block.type)).map((step) => stepIds.includes(step.id) && step.status !== "completed"
                ? {
                    ...step,
                    status: "completed",
                    completedAt,
                    evidenceType: input.evidenceType,
                    evidenceRef: input.evidenceRef,
                }
                : step),
            startedAt: block.startedAt ?? completedAt,
        });
        if (updatedBlock.completedSteps === block.completedSteps &&
            updatedBlock.progressPercentage === block.progressPercentage &&
            updatedBlock.status === block.status) {
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
        const updatedProgress = !wasCompleted && updatedBlock.status === "completed" && this.progressService
            ? await this.progressService.recordBlockCompleted({
                userId: user.id,
                plan: { ...plan, ...planStatus, blocks: updatedBlocks },
                block: updatedBlock,
                previousProgress: progress,
                completedPlanNow,
            })
            : await this.dailyPlanRepository.saveProgress(user.id, {
                ...progress,
                studiedMinutesToday: wasCompleted
                    ? progress.studiedMinutesToday
                    : updatedBlock.status === "completed"
                        ? progress.studiedMinutesToday + block.durationMinutes
                        : progress.studiedMinutesToday,
                streakDays: nextStreakDays,
                consistencyScore: Math.max(progress.consistencyScore, Math.min(100, Math.round((updatedBlocks.filter((entry) => entry.status === "completed").length / updatedBlocks.length) * 100))),
                completedBlocks: !wasCompleted && updatedBlock.status === "completed"
                    ? (progress.completedBlocks ?? 0) + 1
                    : progress.completedBlocks,
                completedPlans: completedPlanNow ? (progress.completedPlans ?? 0) + 1 : progress.completedPlans,
            });
        return { user, dailyPlan: updatedPlan ?? plan, progress: updatedProgress };
    }
}
exports.DailyPlanService = DailyPlanService;
