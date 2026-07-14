"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningPreferencesService = exports.buildGenerationContext = exports.resolveEffectiveLearningPreferences = exports.defaultEffectiveLearningPreferences = exports.LEARNING_PREFERENCES_VERSION = void 0;
exports.LEARNING_PREFERENCES_VERSION = 1;
const validVoices = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
    "marin",
    "cedar",
];
const resolveInterfaceLanguage = (settings) => {
    if (settings.interfaceLanguage === "en" || settings.interfaceLanguage === "pt-BR") {
        return settings.interfaceLanguage;
    }
    return settings.languageMode === "full_english" ? "en" : "pt-BR";
};
const resolvePortugueseSupportLevel = (mode) => {
    switch (mode) {
        case "full_portuguese_support":
            return "full";
        case "english_only":
            return "none";
        case "guided_immersion":
        case "moderate_support":
        default:
            return "moderate";
    }
};
const resolveAccent = (accent) => accent === "british" ? "british" : "american";
const resolveTargetLanguage = (accent) => accent === "british" ? "en-GB" : "en-US";
const resolveVoice = (voice) => validVoices.includes(voice ?? "alloy") ? voice ?? "alloy" : "alloy";
const defaultEffectiveLearningPreferences = (userId = "") => {
    const accent = resolveAccent("american");
    return {
        interfaceLanguage: "pt-BR",
        targetLanguage: resolveTargetLanguage(accent),
        transcriptionLanguage: "en",
        supportLanguage: "pt-BR",
        languageMode: "pt_explanation_en_correction",
        supportLanguageMode: "moderate_support",
        portugueseSupportLevel: "moderate",
        correctionStyle: "gentle",
        accent,
        voice: "alloy",
        primaryObjective: "conversation",
        dailyMinutes: 20,
        version: exports.LEARNING_PREFERENCES_VERSION,
    };
};
exports.defaultEffectiveLearningPreferences = defaultEffectiveLearningPreferences;
const resolveEffectiveLearningPreferences = (settings) => {
    const base = (0, exports.defaultEffectiveLearningPreferences)(settings?.userId);
    const accent = resolveAccent(settings?.preferredAccent);
    const languageMode = settings?.languageMode === "full_english" || settings?.languageMode === "pt_explanation_en_correction"
        ? settings.languageMode
        : base.languageMode;
    const supportLanguageMode = settings?.supportLanguageMode === "full_portuguese_support" ||
        settings?.supportLanguageMode === "moderate_support" ||
        settings?.supportLanguageMode === "guided_immersion" ||
        settings?.supportLanguageMode === "english_only"
        ? settings.supportLanguageMode
        : base.supportLanguageMode;
    const correctionStyle = settings?.correctionStyle === "direct" ||
        settings?.correctionStyle === "detailed" ||
        settings?.correctionStyle === "gentle"
        ? settings.correctionStyle
        : base.correctionStyle;
    return {
        ...base,
        interfaceLanguage: resolveInterfaceLanguage({ ...settings, languageMode }),
        targetLanguage: resolveTargetLanguage(accent),
        languageMode,
        supportLanguageMode,
        portugueseSupportLevel: resolvePortugueseSupportLevel(supportLanguageMode),
        correctionStyle,
        accent,
        voice: resolveVoice(settings?.preferredVoice),
        primaryObjective: settings?.primaryObjective ?? base.primaryObjective,
        dailyMinutes: Number.isFinite(Number(settings?.dailyMinutes)) ? Number(settings?.dailyMinutes) : base.dailyMinutes,
    };
};
exports.resolveEffectiveLearningPreferences = resolveEffectiveLearningPreferences;
const buildGenerationContext = (preferences, promptVersion) => ({
    interfaceLanguage: preferences.interfaceLanguage,
    targetLanguage: preferences.targetLanguage,
    accent: preferences.accent,
    correctionStyle: preferences.correctionStyle,
    portugueseSupportLevel: preferences.portugueseSupportLevel,
    preferencesVersion: preferences.version,
    promptVersion,
});
exports.buildGenerationContext = buildGenerationContext;
class LearningPreferencesService {
    constructor(settingsRepository) {
        this.settingsRepository = settingsRepository;
    }
    async getEffectivePreferences(userId) {
        const settings = await this.settingsRepository.findOrCreate(userId);
        return (0, exports.resolveEffectiveLearningPreferences)(settings);
    }
    async getGenerationContext(userId, promptVersion) {
        return (0, exports.buildGenerationContext)(await this.getEffectivePreferences(userId), promptVersion);
    }
}
exports.LearningPreferencesService = LearningPreferencesService;
