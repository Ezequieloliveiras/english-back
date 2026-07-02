"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String },
    currentLevel: { type: String, required: true },
    dailyMinutes: { type: Number, required: true },
    profession: { type: String, required: true },
    primaryGoal: { type: String, required: true },
    mainDifficulty: { type: String, required: true },
}, { timestamps: true });
exports.UserModel = (0, mongoose_1.model)("User", userSchema);
