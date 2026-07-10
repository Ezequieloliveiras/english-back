"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressModel = void 0;
const mongoose_1 = require("mongoose");
const progressSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    level: { type: String, required: true },
    speakingScore: { type: Number, required: true },
    listeningScore: { type: Number, required: true },
    vocabularyScore: { type: Number, required: true },
    pronunciationScore: { type: Number, required: true },
    consistencyScore: { type: Number, required: true },
    studiedMinutesToday: { type: Number, required: true },
    streakDays: { type: Number, required: true },
}, { timestamps: true });
exports.ProgressModel = (0, mongoose_1.model)("Progress", progressSchema);
