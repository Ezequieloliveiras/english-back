"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentMistakeModel = void 0;
const mongoose_1 = require("mongoose");
const studentMistakeSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    originalSentence: { type: String, required: true },
    correctedSentence: { type: String, required: true },
    mistakeType: { type: String, required: true },
    explanation: { type: String, required: true },
    reviewDate: { type: Date, required: true },
    status: { type: String, required: true, default: "pending" },
}, { timestamps: true });
exports.StudentMistakeModel = (0, mongoose_1.model)("StudentMistake", studentMistakeSchema);
