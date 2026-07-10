"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../models/user.model");
const userSettings_model_1 = require("../models/userSettings.model");
const isDatabaseReady = () => mongoose_1.default.connection.readyState === 1;
const defaultSettings = (userId) => ({
    userId,
    languageMode: "pt_explanation_en_correction",
    supportLanguageMode: "moderate_support",
    preferredAccent: "american",
    correctionStyle: "gentle",
    interfaceLanguage: "pt-BR",
    primaryObjective: "conversation",
    dailyMinutes: 20,
});
const memorySettings = new Map();
const mapSettings = (settings) => ({
    userId: String(settings.userId),
    languageMode: settings.languageMode,
    supportLanguageMode: settings.supportLanguageMode ?? "moderate_support",
    preferredAccent: settings.preferredAccent,
    correctionStyle: settings.correctionStyle,
    interfaceLanguage: settings.interfaceLanguage,
    primaryObjective: settings.primaryObjective,
    dailyMinutes: settings.dailyMinutes,
    createdAt: settings.createdAt?.toISOString?.(),
    updatedAt: settings.updatedAt?.toISOString?.(),
});
const coerceSettings = (userId, input) => {
    const base = defaultSettings(userId);
    return {
        userId,
        languageMode: input.languageMode === "full_english" || input.languageMode === "pt_explanation_en_correction"
            ? input.languageMode
            : base.languageMode,
        supportLanguageMode: input.supportLanguageMode === "full_portuguese_support" ||
            input.supportLanguageMode === "moderate_support" ||
            input.supportLanguageMode === "guided_immersion" ||
            input.supportLanguageMode === "english_only"
            ? input.supportLanguageMode
            : base.supportLanguageMode,
        preferredAccent: input.preferredAccent === "british" || input.preferredAccent === "neutral" || input.preferredAccent === "american"
            ? input.preferredAccent
            : base.preferredAccent,
        correctionStyle: input.correctionStyle === "direct" || input.correctionStyle === "detailed" || input.correctionStyle === "gentle"
            ? input.correctionStyle
            : base.correctionStyle,
        interfaceLanguage: input.languageMode === "full_english" ? "en" : "pt-BR",
        primaryObjective: input.primaryObjective === "interview" ||
            input.primaryObjective === "work" ||
            input.primaryObjective === "travel" ||
            input.primaryObjective === "technical_english" ||
            input.primaryObjective === "conversation"
            ? input.primaryObjective
            : base.primaryObjective,
        dailyMinutes: Math.max(10, Math.min(45, Number(input.dailyMinutes ?? base.dailyMinutes))),
    };
};
class SettingsRepository {
    async findOrCreate(userId) {
        if (!isDatabaseReady()) {
            const existing = memorySettings.get(userId);
            if (existing)
                return existing;
            const created = defaultSettings(userId);
            memorySettings.set(userId, created);
            return created;
        }
        const settings = await userSettings_model_1.UserSettingsModel.findOneAndUpdate({ userId }, { $setOnInsert: defaultSettings(userId) }, { new: true, upsert: true });
        return mapSettings(settings);
    }
    async update(userId, input) {
        const next = coerceSettings(userId, input);
        if (!isDatabaseReady()) {
            const updated = { ...defaultSettings(userId), ...(memorySettings.get(userId) ?? {}), ...next };
            memorySettings.set(userId, updated);
            return updated;
        }
        const updated = await userSettings_model_1.UserSettingsModel.findOneAndUpdate({ userId }, { $set: next }, { new: true, upsert: true });
        await user_model_1.UserModel.findByIdAndUpdate(userId, {
            $set: {
                dailyMinutes: next.dailyMinutes,
                primaryGoal: next.primaryObjective,
            },
        });
        return mapSettings(updated);
    }
}
exports.SettingsRepository = SettingsRepository;
