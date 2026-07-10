"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudyBlockModel = void 0;
const mongoose_1 = require("mongoose");
const studyBlockSchema = new mongoose_1.Schema({
    planId: { type: mongoose_1.Schema.Types.ObjectId, ref: "DailyPlan", required: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, required: true },
    progress: { type: Number, required: true },
    objective: { type: String, required: true },
}, { timestamps: true });
exports.StudyBlockModel = (0, mongoose_1.model)("StudyBlock", studyBlockSchema);
