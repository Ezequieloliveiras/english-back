"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPlanService = void 0;
const todayKey = () => new Date().toISOString().slice(0, 10);
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
const blockTypeOrder = Object.keys(blockTemplates);
const baseWeights = {
    shadowing: 0.22,
    "speaking-coach": 0.16,
    listening: 0.2,
    vocabulary: 0.13,
    conversation: 0.21,
    review: 0.08,
};
const difficultyBoost = {
    speaking: { conversation: 0.1, "speaking-coach": 0.08, shadowing: 0.05, listening: -0.04, vocabulary: -0.03 },
    listening: { listening: 0.14, shadowing: 0.03, conversation: -0.04, vocabulary: -0.03 },
    vocabulary: { vocabulary: 0.14, review: 0.05, conversation: -0.04, shadowing: -0.03 },
    pronunciation: { "speaking-coach": 0.12, shadowing: 0.1, conversation: 0.04, vocabulary: -0.04, review: -0.02 },
};
const levelBoost = {
    A1: { listening: 0.07, vocabulary: 0.05, conversation: -0.05 },
    A2: { shadowing: 0.04, "speaking-coach": 0.03, conversation: 0.03 },
    B1: { conversation: 0.07, review: 0.02, listening: -0.03 },
    B2: { conversation: 0.1, review: 0.03, vocabulary: -0.04 },
    C1: { conversation: 0.12, review: 0.04, listening: -0.04 },
};
const normalizeLevel = (level) => {
    const value = level.toUpperCase();
    return ["A1", "A2", "B1", "B2", "C1"].includes(value) ? value : "A1";
};
const normalizeDifficulty = (difficulty) => {
    if (["listening", "speaking", "vocabulary", "pronunciation"].includes(difficulty)) {
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
const buildFocus = (profile) => {
    const focusByDifficulty = {
        speaking: "Build speaking confidence with short, realistic conversations.",
        listening: "Train your ear with short, comprehensible input before output.",
        vocabulary: "Turn sentence mining into phrases you can reuse today.",
        pronunciation: "Improve clarity with shadowing and controlled repetition.",
    };
    return `${focusByDifficulty[profile.mainDifficulty]} Goal: ${profile.primaryGoal}`;
};
const distributeMinutes = (totalMinutes, weights) => {
    const blockTypes = Object.keys(weights);
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
class DailyPlanService {
    constructor(dailyPlanRepository) {
        this.dailyPlanRepository = dailyPlanRepository;
    }
    generatePlan(profile, date = todayKey(), rotation = 0) {
        const level = normalizeLevel(profile.currentLevel);
        const difficulty = normalizeDifficulty(profile.mainDifficulty);
        let weights = { ...baseWeights };
        weights = applyBoost(weights, difficultyBoost[difficulty]);
        weights = applyBoost(weights, levelBoost[level]);
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
            status: "pending",
            progress: 0,
        }));
        return {
            userId: profile.id,
            focus: buildFocus({ ...profile, currentLevel: level, mainDifficulty: difficulty }),
            totalMinutes: blocks.reduce((sum, block) => sum + block.durationMinutes, 0),
            streak: 0,
            date,
            blocks,
        };
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
            return { user: resolvedUser, dailyPlan: existingPlan, progress };
        }
        const plan = await this.dailyPlanRepository.savePlan({
            ...this.generatePlan(resolvedUser, date),
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
            ...this.generatePlan(user),
            streak: progress.streakDays,
        });
        return { user, dailyPlan: plan, progress };
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
            ...this.generatePlan(resolvedUser, date, rotation),
            streak: progress.streakDays,
        });
        return { user: resolvedUser, dailyPlan: plan, progress };
    }
    async completeBlock(planId, blockId, userId) {
        const { user, dailyPlan, progress } = await this.createOrGetTodayPlan(userId);
        const plan = dailyPlan.id === planId ? dailyPlan : null;
        if (!plan) {
            return null;
        }
        const block = plan.blocks.find((entry) => entry.id === blockId);
        if (!block) {
            return null;
        }
        const wasCompleted = block.status === "completed";
        const updatedBlocks = plan.blocks.map((entry) => entry.id === blockId
            ? { ...entry, status: "completed", progress: 100 }
            : entry);
        const updatedPlan = await this.dailyPlanRepository.updatePlanBlocks({
            ...plan,
            blocks: updatedBlocks,
        });
        const studiedMinutesToday = wasCompleted
            ? progress.studiedMinutesToday
            : progress.studiedMinutesToday + block.durationMinutes;
        const completedBlocks = updatedBlocks.filter((entry) => entry.status === "completed").length;
        const consistencyScore = Math.min(100, Math.round((completedBlocks / updatedBlocks.length) * 100));
        const updatedProgress = await this.dailyPlanRepository.saveProgress(user.id, {
            ...progress,
            studiedMinutesToday,
            consistencyScore: Math.max(progress.consistencyScore, consistencyScore),
        });
        return { user, dailyPlan: updatedPlan, progress: updatedProgress };
    }
}
exports.DailyPlanService = DailyPlanService;
