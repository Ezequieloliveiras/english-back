"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VocabularyItemModel = void 0;
const mongoose_1 = require("mongoose");
const sentenceSchema = new mongoose_1.Schema({
    text: { type: String, required: true },
    translation: { type: String },
}, { _id: false });
const vocabularyItemSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    phrase: { type: String, required: true },
    translation: { type: String },
    level: { type: String, required: true },
    category: { type: String, required: true },
    sentences: { type: [sentenceSchema], required: true },
    confidence: { type: Number, required: true },
    nextReviewAt: { type: Date, required: true },
    hits: { type: Number, required: true, default: 0 },
    misses: { type: Number, required: true, default: 0 },
    source: { type: String, required: true, default: "user_saved" },
    timesPracticed: { type: Number, required: true, default: 0 },
    timesCorrect: { type: Number, required: true, default: 0 },
    timesWrong: { type: Number, required: true, default: 0 },
}, { timestamps: true });
exports.VocabularyItemModel = (0, mongoose_1.model)("VocabularyItem", vocabularyItemSchema);
