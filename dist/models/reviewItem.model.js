"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewItemModel = void 0;
const mongoose_1 = require("mongoose");
const reviewItemSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    vocabularyItemId: { type: mongoose_1.Schema.Types.ObjectId, ref: "VocabularyItem", required: true },
    dueDate: { type: Date, required: true },
    status: {
        type: String,
        required: true,
        default: "due",
        enum: ["due", "scheduled", "completed"],
    },
    reviewCount: { type: Number, required: true, default: 0 },
    lastResult: {
        type: String,
        enum: ["correct", "wrong", "skipped", null],
        default: null,
    },
}, { timestamps: true });
reviewItemSchema.index({ userId: 1, vocabularyItemId: 1 }, { unique: true });
exports.ReviewItemModel = (0, mongoose_1.model)("ReviewItem", reviewItemSchema);
