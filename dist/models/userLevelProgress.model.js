"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserLevelProgressModel = void 0;
const mongoose_1 = require("mongoose");
const userLevelProgressSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    currentLevel: { type: String, required: true },
    targetLevel: { type: String, required: true },
    levelProgress: { type: Number, required: true, default: 0 },
    competenciesMastered: { type: Number, required: true, default: 0 },
    competenciesRequired: { type: Number, required: true, default: 0 },
    checkpointStatus: {
        type: String,
        required: true,
        default: "locked",
        enum: ["locked", "available", "in_progress", "passed", "failed"],
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
}, { timestamps: true });
userLevelProgressSchema.index({ userId: 1 }, { unique: true });
exports.UserLevelProgressModel = (0, mongoose_1.model)("UserLevelProgress", userLevelProgressSchema);
