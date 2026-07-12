"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPlanRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dailyPlan_model_1 = require("../models/dailyPlan.model");
const progress_model_1 = require("../models/progress.model");
const user_model_1 = require("../models/user.model");
const isDatabaseReady = () => mongoose_1.default.connection.readyState === 1;
const toPlainId = (value) => String(value ?? "");
const mapBlock = (block) => ({
    id: block.id,
    title: block.title,
    type: block.type,
    durationMinutes: block.durationMinutes,
    status: block.status,
    progress: block.progress,
    objective: block.objective,
    requiredSteps: (block.requiredSteps ?? []).map((step) => ({
        id: step.id,
        label: step.label,
        status: step.status,
        required: Boolean(step.required),
        completedAt: step.completedAt ?? null,
        evidenceType: step.evidenceType,
        evidenceRef: step.evidenceRef,
    })),
    completedSteps: block.completedSteps ?? 0,
    totalSteps: block.totalSteps ?? 0,
    progressPercentage: block.progressPercentage ?? block.progress ?? 0,
    startedAt: block.startedAt ?? null,
    completedAt: block.completedAt ?? null,
});
const mapPlan = (plan) => ({
    id: toPlainId(plan._id ?? plan.id),
    userId: toPlainId(plan.userId),
    focus: plan.focus,
    totalMinutes: plan.totalMinutes,
    streak: plan.streak,
    date: plan.date,
    status: plan.status ?? "not_started",
    completedAt: plan.completedAt ?? null,
    learningUnitId: plan.learningUnitId,
    scenario: plan.scenario,
    targetCompetencies: plan.targetCompetencies ?? [],
    targetChunks: plan.targetChunks ?? [],
    blocks: plan.blocks.map(mapBlock),
});
const mapUser = (user) => ({
    id: toPlainId(user._id ?? user.id),
    name: user.name,
    email: user.email,
    currentLevel: user.currentLevel,
    dailyMinutes: user.dailyMinutes,
    profession: user.profession,
    primaryGoal: user.primaryGoal,
    mainDifficulty: user.mainDifficulty,
});
const mapProgress = (progress) => ({
    level: progress.level,
    speakingScore: progress.speakingScore,
    listeningScore: progress.listeningScore,
    vocabularyScore: progress.vocabularyScore,
    pronunciationScore: progress.pronunciationScore,
    consistencyScore: progress.consistencyScore,
    studiedMinutesToday: progress.studiedMinutesToday,
    streakDays: progress.streakDays,
});
const createInitialProgress = (level) => ({
    level,
    speakingScore: 0,
    listeningScore: 0,
    vocabularyScore: 0,
    pronunciationScore: 0,
    consistencyScore: 0,
    studiedMinutesToday: 0,
    streakDays: 0,
});
const isLegacyDemoProgress = (progress) => progress.speakingScore === 64 &&
    progress.listeningScore === 71 &&
    progress.vocabularyScore === 69 &&
    progress.pronunciationScore === 58 &&
    progress.consistencyScore === 88 &&
    progress.studiedMinutesToday === 0 &&
    progress.streakDays === 14;
const memoryState = {
    users: new Map(),
    plans: new Map(),
    progress: new Map(),
};
class DailyPlanRepository {
    async findUserById(userId) {
        if (!isDatabaseReady()) {
            return memoryState.users.get(userId) ?? null;
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return null;
        }
        const user = await user_model_1.UserModel.findById(userId);
        return user ? mapUser(user) : null;
    }
    async updateUserProfile(userId, profile) {
        if (!isDatabaseReady()) {
            const existing = memoryState.users.get(userId);
            if (!existing) {
                return null;
            }
            const updated = { ...existing, ...profile, id: existing.id, email: existing.email };
            memoryState.users.set(userId, updated);
            return updated;
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return null;
        }
        const updated = await user_model_1.UserModel.findByIdAndUpdate(userId, {
            $set: {
                ...(profile.name ? { name: profile.name } : {}),
                ...(profile.currentLevel ? { currentLevel: profile.currentLevel } : {}),
                ...(profile.dailyMinutes ? { dailyMinutes: profile.dailyMinutes } : {}),
                ...(profile.profession ? { profession: profile.profession } : {}),
                ...(profile.primaryGoal ? { primaryGoal: profile.primaryGoal } : {}),
                ...(profile.mainDifficulty ? { mainDifficulty: profile.mainDifficulty } : {}),
            },
        }, { new: true });
        return updated ? mapUser(updated) : null;
    }
    async findPlanByUserAndDate(userId, date) {
        if (!isDatabaseReady()) {
            return memoryState.plans.get(`${userId}:${date}`) ?? null;
        }
        const plan = await dailyPlan_model_1.DailyPlanModel.findOne({ userId, date });
        return plan ? mapPlan(plan) : null;
    }
    async savePlan(plan) {
        if (!isDatabaseReady()) {
            const id = plan.id ?? `plan-${memoryState.plans.size + 1}`;
            const saved = { ...plan, id };
            memoryState.plans.set(`${saved.userId}:${saved.date}`, saved);
            return saved;
        }
        const saved = await dailyPlan_model_1.DailyPlanModel.findOneAndUpdate({ userId: plan.userId, date: plan.date }, {
            $set: {
                focus: plan.focus,
                totalMinutes: plan.totalMinutes,
                streak: plan.streak,
                date: plan.date,
                status: plan.status ?? "not_started",
                completedAt: plan.completedAt ?? null,
                learningUnitId: plan.learningUnitId,
                scenario: plan.scenario,
                targetCompetencies: plan.targetCompetencies ?? [],
                targetChunks: plan.targetChunks ?? [],
                blocks: plan.blocks,
            },
        }, { new: true, upsert: true });
        return mapPlan(saved);
    }
    async updatePlanBlocks(plan) {
        if (!isDatabaseReady()) {
            memoryState.plans.set(`${plan.userId}:${plan.date}`, plan);
            return plan;
        }
        const updated = await dailyPlan_model_1.DailyPlanModel.findByIdAndUpdate(plan.id, { $set: { blocks: plan.blocks, status: plan.status ?? "not_started", completedAt: plan.completedAt ?? null } }, { new: true });
        return updated ? mapPlan(updated) : null;
    }
    async findOrCreateProgress(user) {
        if (!isDatabaseReady()) {
            const existing = memoryState.progress.get(user.id);
            if (existing) {
                if (isLegacyDemoProgress(existing)) {
                    const resetProgress = createInitialProgress(user.currentLevel);
                    memoryState.progress.set(user.id, resetProgress);
                    return resetProgress;
                }
                return existing;
            }
            const progress = createInitialProgress(user.currentLevel);
            memoryState.progress.set(user.id, progress);
            return progress;
        }
        const progress = await progress_model_1.ProgressModel.findOneAndUpdate({ userId: user.id }, {
            $setOnInsert: {
                ...createInitialProgress(user.currentLevel),
            },
        }, { new: true, upsert: true });
        const mappedProgress = mapProgress(progress);
        if (isLegacyDemoProgress(mappedProgress)) {
            const resetProgress = await progress_model_1.ProgressModel.findOneAndUpdate({ userId: user.id }, { $set: createInitialProgress(user.currentLevel) }, { new: true });
            return mapProgress(resetProgress);
        }
        return mappedProgress;
    }
    async saveProgress(userId, progress) {
        if (!isDatabaseReady()) {
            memoryState.progress.set(userId, progress);
            return progress;
        }
        const saved = await progress_model_1.ProgressModel.findOneAndUpdate({ userId }, { $set: progress }, { new: true, upsert: true });
        return mapProgress(saved);
    }
}
exports.DailyPlanRepository = DailyPlanRepository;
