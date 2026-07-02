"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGoalModel = void 0;
const mongoose_1 = require("mongoose");
const userGoalSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true },
    targetLevel: { type: String, required: true },
    progress: { type: Number, required: true },
}, { timestamps: true });
exports.UserGoalModel = (0, mongoose_1.model)("UserGoal", userGoalSchema);
