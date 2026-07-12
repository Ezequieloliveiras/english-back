"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompetencyProgressModel = void 0;
const mongoose_1 = require("mongoose");
const competencyEvidenceSchema = new mongoose_1.Schema({
    type: { type: String, required: true },
    score: { type: Number, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
    sourceId: { type: String },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { _id: false });
const competencyProgressSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    competencyId: { type: String, required: true },
    masteryScore: { type: Number, required: true, default: 0 },
    retentionScore: { type: Number, required: true, default: 0 },
    confidenceScore: { type: Number, required: true, default: 0 },
    attempts: { type: Number, required: true, default: 0 },
    successfulAttempts: { type: Number, required: true, default: 0 },
    lastPracticedAt: { type: Date, default: null },
    lastAssessedAt: { type: Date, default: null },
    masteredAt: { type: Date, default: null },
    status: {
        type: String,
        required: true,
        default: "learning",
        enum: ["locked", "learning", "reviewing", "mastered"],
    },
    evidence: { type: [competencyEvidenceSchema], required: true, default: [] },
}, { timestamps: true });
competencyProgressSchema.index({ userId: 1, competencyId: 1 }, { unique: true });
exports.CompetencyProgressModel = (0, mongoose_1.model)("CompetencyProgress", competencyProgressSchema);
