"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGoalRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userGoal_model_1 = require("../models/userGoal.model");
const isDatabaseReady = () => mongoose_1.default.connection.readyState === 1;
const mapGoal = (goal) => ({
    id: String(goal._id ?? goal.id),
    userId: String(goal.userId),
    primaryGoal: goal.primaryGoal,
    targetLevel: goal.targetLevel,
    professionalContext: goal.professionalContext ?? "",
    deadline: goal.deadline?.toISOString?.(),
    createdAt: goal.createdAt?.toISOString?.(),
    updatedAt: goal.updatedAt?.toISOString?.(),
});
const memoryGoals = new Map();
class UserGoalRepository {
    async findByUserId(userId) {
        if (!isDatabaseReady()) {
            return memoryGoals.get(userId) ?? null;
        }
        const goal = await userGoal_model_1.UserGoalModel.findOne({ userId });
        return goal ? mapGoal(goal) : null;
    }
    async upsertGoal(userId, input) {
        if (!isDatabaseReady()) {
            const now = new Date().toISOString();
            const existing = memoryGoals.get(userId);
            const saved = {
                id: existing?.id ?? `goal-${userId}`,
                userId,
                primaryGoal: input.primaryGoal,
                targetLevel: input.targetLevel,
                professionalContext: input.professionalContext ?? "",
                deadline: input.deadline ? new Date(input.deadline).toISOString() : undefined,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
            };
            memoryGoals.set(userId, saved);
            return saved;
        }
        const update = {
            $set: {
                primaryGoal: input.primaryGoal,
                targetLevel: input.targetLevel,
                professionalContext: input.professionalContext ?? "",
            },
        };
        if (input.deadline) {
            update.$set = { ...update.$set, deadline: new Date(input.deadline) };
        }
        else {
            update.$unset = { deadline: "" };
        }
        const goal = await userGoal_model_1.UserGoalModel.findOneAndUpdate({ userId }, update, { new: true, upsert: true, setDefaultsOnInsert: true });
        return mapGoal(goal);
    }
}
exports.UserGoalRepository = UserGoalRepository;
