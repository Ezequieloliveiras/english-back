"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewScheduleModel = void 0;
const mongoose_1 = require("mongoose");
const reviewScheduleSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    vocabularyItemId: { type: mongoose_1.Schema.Types.ObjectId, ref: "VocabularyItem", required: true },
    hits: { type: Number, required: true, default: 0 },
    misses: { type: Number, required: true, default: 0 },
    confidence: { type: Number, required: true, default: 50 },
    nextReviewAt: { type: Date, required: true },
}, { timestamps: true });
reviewScheduleSchema.index({ userId: 1, vocabularyItemId: 1 }, { unique: true });
exports.ReviewScheduleModel = (0, mongoose_1.model)("ReviewSchedule", reviewScheduleSchema);
