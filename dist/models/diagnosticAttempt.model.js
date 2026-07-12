"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticAttemptModel = void 0;
const mongoose_1 = require("mongoose");
const diagnosticEvidenceSchema = new mongoose_1.Schema({
    type: { type: String, required: true },
    score: { type: Number, required: true },
    payload: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { _id: false });
const diagnosticAttemptSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    declaredLevel: { type: String },
    diagnosedLevel: { type: String },
    selectedLevel: { type: String },
    confidence: { type: Number, required: true, default: 0 },
    evidence: { type: [diagnosticEvidenceSchema], required: true, default: [] },
    status: {
        type: String,
        required: true,
        default: "in_progress",
        enum: ["in_progress", "completed"],
    },
}, { timestamps: true });
diagnosticAttemptSchema.index({ userId: 1, createdAt: -1 });
exports.DiagnosticAttemptModel = (0, mongoose_1.model)("DiagnosticAttempt", diagnosticAttemptSchema);
