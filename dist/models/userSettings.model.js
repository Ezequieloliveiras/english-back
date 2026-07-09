"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSettingsModel = void 0;
const mongoose_1 = require("mongoose");
const userSettingsSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    languageMode: {
        type: String,
        required: true,
        default: "pt_explanation_en_correction",
        enum: ["pt_explanation_en_correction", "full_english"],
    },
    preferredAccent: {
        type: String,
        required: true,
        default: "american",
        enum: ["american", "british", "neutral"],
    },
    correctionStyle: {
        type: String,
        required: true,
        default: "gentle",
        enum: ["gentle", "direct", "detailed"],
    },
    interfaceLanguage: {
        type: String,
        required: true,
        default: "pt-BR",
        enum: ["pt-BR", "en"],
    },
    primaryObjective: {
        type: String,
        required: true,
        default: "conversation",
        enum: ["conversation", "interview", "work", "travel", "technical_english"],
    },
    dailyMinutes: { type: Number, required: true, default: 20 },
}, { timestamps: true });
exports.UserSettingsModel = (0, mongoose_1.model)("UserSettings", userSettingsSchema);
