"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGoalModel = void 0;
const mongoose_1 = require("mongoose");
const userGoalSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    primaryGoal: { type: String, required: true },
    targetLevel: { type: String, required: true },
    professionalContext: { type: String, default: "" },
    deadline: { type: Date },
}, { timestamps: true });
userGoalSchema.index({ userId: 1 }, { unique: true });
exports.UserGoalModel = (0, mongoose_1.model)("UserGoal", userGoalSchema);
