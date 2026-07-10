"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticeRepository = void 0;
const listeningAttempt_model_1 = require("../models/listeningAttempt.model");
const practiceActivity_model_1 = require("../models/practiceActivity.model");
class PracticeRepository {
    async completeActivity(input) {
        return practiceActivity_model_1.PracticeActivityModel.findOneAndUpdate({ userId: input.userId, type: input.type, itemId: input.itemId }, {
            $set: {
                title: input.title,
                status: "completed",
                completedAt: new Date(),
            },
        }, { new: true, upsert: true });
    }
    async saveListeningAttempt(input) {
        return listeningAttempt_model_1.ListeningAttemptModel.create({
            ...input,
            completedAt: new Date(),
        });
    }
}
exports.PracticeRepository = PracticeRepository;
