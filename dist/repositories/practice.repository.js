"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticeRepository = void 0;
const listeningAttempt_model_1 = require("../models/listeningAttempt.model");
const practiceActivity_model_1 = require("../models/practiceActivity.model");
const toPlainId = (value) => String(value ?? "");
class PracticeRepository {
    async getUserCompletionState(userId) {
        const [activities, listeningAttempts] = await Promise.all([
            practiceActivity_model_1.PracticeActivityModel.find({ userId, status: "completed" }).select("type itemId title completedAt"),
            listeningAttempt_model_1.ListeningAttemptModel.find({ userId }).select("exerciseId completedAt"),
        ]);
        return {
            completedActivities: activities.map((activity) => ({
                id: toPlainId(activity._id),
                type: activity.type,
                itemId: activity.itemId,
                title: activity.title,
                completedAt: activity.completedAt?.toISOString?.() ?? String(activity.completedAt),
            })),
            listeningAttempts: listeningAttempts.map((attempt) => ({
                id: toPlainId(attempt._id),
                exerciseId: attempt.exerciseId,
                completedAt: attempt.completedAt?.toISOString?.() ?? String(attempt.completedAt),
            })),
        };
    }
    async completeActivity(input) {
        const query = { userId: input.userId, type: input.type, itemId: input.itemId };
        const existing = await practiceActivity_model_1.PracticeActivityModel.findOne(query);
        if (existing) {
            return { activity: existing, created: false };
        }
        try {
            const activity = await practiceActivity_model_1.PracticeActivityModel.create({
                ...input,
                status: "completed",
                completedAt: new Date(),
            });
            return { activity, created: true };
        }
        catch (error) {
            if (error?.code === 11000) {
                const activity = await practiceActivity_model_1.PracticeActivityModel.findOne(query);
                if (activity) {
                    return { activity, created: false };
                }
            }
            throw error;
        }
    }
    async saveListeningAttempt(input) {
        const query = { userId: input.userId, exerciseId: input.exerciseId };
        const existing = await listeningAttempt_model_1.ListeningAttemptModel.findOne(query);
        if (existing) {
            return { attempt: existing, created: false };
        }
        try {
            const attempt = await listeningAttempt_model_1.ListeningAttemptModel.create({
                ...input,
                completedAt: new Date(),
            });
            return { attempt, created: true };
        }
        catch (error) {
            if (error?.code === 11000) {
                const attempt = await listeningAttempt_model_1.ListeningAttemptModel.findOne(query);
                if (attempt) {
                    return { attempt, created: false };
                }
            }
            throw error;
        }
    }
}
exports.PracticeRepository = PracticeRepository;
