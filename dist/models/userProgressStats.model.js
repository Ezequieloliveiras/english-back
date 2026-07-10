"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProgressStatsModel = void 0;
const mongoose_1 = require("mongoose");
const userProgressStatsSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    totalWordsPronounced: { type: Number, required: true, default: 0 },
    totalPhrasesPracticed: { type: Number, required: true, default: 0 },
    totalSpeakingSessions: { type: Number, required: true, default: 0 },
    totalStudyMinutes: { type: Number, required: true, default: 0 },
    totalRecordings: { type: Number, required: true, default: 0 },
    totalCorrections: { type: Number, required: true, default: 0 },
    currentStreak: { type: Number, required: true, default: 0 },
    lastStudyDate: { type: Date },
    mainImprovementArea: { type: String, required: true, default: "Not enough data yet" },
    mostPracticedWords: { type: [String], required: true, default: [] },
    mostMissedWords: { type: [String], required: true, default: [] },
}, { timestamps: true });
exports.UserProgressStatsModel = (0, mongoose_1.model)("UserProgressStats", userProgressStatsSchema);
