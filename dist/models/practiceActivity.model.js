"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticeActivityModel = void 0;
const mongoose_1 = require("mongoose");
const practiceActivitySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    itemId: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, required: true, default: "completed" },
    completedAt: { type: Date, required: true },
}, { timestamps: true });
practiceActivitySchema.index({ userId: 1, type: 1, itemId: 1 }, { unique: true });
exports.PracticeActivityModel = (0, mongoose_1.model)("PracticeActivity", practiceActivitySchema);
