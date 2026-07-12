"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPlanModel = void 0;
const mongoose_1 = require("mongoose");
const studyBlockSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, required: true },
    progress: { type: Number, required: true },
    objective: { type: String, required: true },
}, { _id: false });
const dailyPlanSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    focus: { type: String, required: true },
    totalMinutes: { type: Number, required: true },
    streak: { type: Number, required: true },
    date: { type: String, required: true },
    learningUnitId: { type: String },
    scenario: { type: String },
    targetCompetencies: { type: [String], required: true, default: [] },
    targetChunks: { type: [String], required: true, default: [] },
    blocks: { type: [studyBlockSchema], required: true },
}, { timestamps: true });
exports.DailyPlanModel = (0, mongoose_1.model)("DailyPlan", dailyPlanSchema);
