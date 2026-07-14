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
    preferredVoice: "alloy",
    correctionStyle: "gentle",
    interfaceLanguage: "pt-BR",
    primaryObjective: "conversation",
    goalType: "conversation",
    goalDescription: "",
    targetLevel: "B1",
    dailyMinutes: 20,
});
const memorySettings = new Map();
const mapSettings = (settings) => ({
    userId: String(settings.userId),
    languageMode: settings.languageMode,
    supportLanguageMode: settings.supportLanguageMode ?? "moderate_support",
    preferredAccent: settings.preferredAccent,
    preferredVoice: settings.preferredVoice ?? "alloy",
    correctionStyle: settings.correctionStyle,
    interfaceLanguage: settings.interfaceLanguage ?? (settings.languageMode === "full_english" ? "en" : "pt-BR"),
    primaryObjective: settings.primaryObjective,
    goalType: settings.goalType ?? settings.primaryObjective,
    goalDescription: settings.goalDescription ?? "",
    targetLevel: settings.targetLevel ?? "B1",
    dailyMinutes: settings.dailyMinutes,
    createdAt: settings.createdAt?.toISOString?.(),
    updatedAt: settings.updatedAt?.toISOString?.(),
});
const isInterfaceLanguage = (value) => value === "pt-BR" || value === "en";
const resolveInterfaceLanguage = (current, merged, rawInput) => {
    if (isInterfaceLanguage(rawInput.interfaceLanguage)) {
        return rawInput.interfaceLanguage;
    }
    if (rawInput.languageMode === "full_english") {
        return "en";
    }
    if (rawInput.languageMode === "pt_explanation_en_correction") {
        return "pt-BR";
    }
    if (isInterfaceLanguage(merged.interfaceLanguage)) {
        return merged.interfaceLanguage;
    }
    if (isInterfaceLanguage(current.interfaceLanguage)) {
        return current.interfaceLanguage;
    }
    return merged.languageMode === "full_english" ? "en" : "pt-BR";
};
const coerceSettings = (userId, input, current = defaultSettings(userId), rawInput = input) => {
    const base = defaultSettings(userId);
    const languageMode = input.languageMode === "full_english" || input.languageMode === "pt_explanation_en_correction"
        ? input.languageMode
        : base.languageMode;
    const supportLanguageMode = input.supportLanguageMode === "full_portuguese_support" ||
        input.supportLanguageMode === "moderate_support" ||
        input.supportLanguageMode === "guided_immersion" ||
        input.supportLanguageMode === "english_only"
        ? input.supportLanguageMode
        : base.supportLanguageMode;
    const preferredAccent = input.preferredAccent === "british" || input.preferredAccent === "neutral" || input.preferredAccent === "american"
        ? input.preferredAccent
        : base.preferredAccent;
    const preferredVoice = input.preferredVoice === "ash" ||
        input.preferredVoice === "ballad" ||
        input.preferredVoice === "coral" ||
        input.preferredVoice === "echo" ||
        input.preferredVoice === "fable" ||
        input.preferredVoice === "nova" ||
        input.preferredVoice === "onyx" ||
        input.preferredVoice === "sage" ||
        input.preferredVoice === "shimmer" ||
        input.preferredVoice === "verse" ||
        input.preferredVoice === "marin" ||
        input.preferredVoice === "cedar" ||
        input.preferredVoice === "alloy"
        ? input.preferredVoice
        : base.preferredVoice;
    const correctionStyle = input.correctionStyle === "direct" || input.correctionStyle === "detailed" || input.correctionStyle === "gentle"
        ? input.correctionStyle
        : base.correctionStyle;
    const primaryObjective = input.primaryObjective === "interview" ||
        input.primaryObjective === "work" ||
        input.primaryObjective === "travel" ||
        input.primaryObjective === "technical_english" ||
        input.primaryObjective === "conversation"
        ? input.primaryObjective
        : base.primaryObjective;
    const goalType = input.goalType === "interview" ||
        input.goalType === "work" ||
        input.goalType === "travel" ||
        input.goalType === "technical_english" ||
        input.goalType === "conversation"
        ? input.goalType
        : input.primaryObjective ?? base.goalType;
    return {
        userId,
        languageMode,
        supportLanguageMode,
        preferredAccent,
        preferredVoice,
        correctionStyle,
        interfaceLanguage: resolveInterfaceLanguage(current, { ...input, languageMode }, rawInput),
        primaryObjective,
        goalType,
        goalDescription: typeof input.goalDescription === "string"
            ? input.goalDescription.trim()
            : base.goalDescription,
        targetLevel: input.targetLevel === "A1" ||
            input.targetLevel === "A2" ||
            input.targetLevel === "B1" ||
            input.targetLevel === "B2" ||
            input.targetLevel === "C1"
            ? input.targetLevel
            : base.targetLevel,
        dailyMinutes: Math.max(10, Math.min(45, Number(input.dailyMinutes ?? base.dailyMinutes))),
    };
};
class SettingsRepository {
    constructor(userGoalRepository) {
        this.userGoalRepository = userGoalRepository;
    }
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
        const current = await this.findOrCreate(userId);
        const next = coerceSettings(userId, { ...current, ...input }, current, input);
        if (!isDatabaseReady()) {
            const updated = { ...defaultSettings(userId), ...current, ...next };
            memorySettings.set(userId, updated);
            return updated;
        }
        const updated = await userSettings_model_1.UserSettingsModel.findOneAndUpdate({ userId }, { $set: next }, { new: true, upsert: true });
        await user_model_1.UserModel.findByIdAndUpdate(userId, {
            $set: {
                dailyMinutes: next.dailyMinutes,
            },
        });
        if (next.goalDescription) {
            await this.userGoalRepository?.upsertGoal(userId, {
                primaryGoal: next.goalDescription,
                targetLevel: next.targetLevel ?? "B1",
            });
        }
        return mapSettings(updated);
    }
}
exports.SettingsRepository = SettingsRepository;
