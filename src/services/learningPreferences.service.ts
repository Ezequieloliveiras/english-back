import { SettingsRepository, UserSettings } from "../repositories/settings.repository";

export type InterfaceLanguage = "pt-BR" | "en";
export type TargetLanguage = "en-US" | "en-GB";
export type TranscriptionLanguage = "en";
export type SupportLanguage = "pt-BR";
export type PortugueseSupportLevel = "none" | "moderate" | "full";
export type EffectiveAccent = "american" | "british";
export type EffectiveCorrectionStyle = "gentle" | "direct" | "detailed";

export const LEARNING_PREFERENCES_VERSION = 1;

export interface EffectiveLearningPreferences {
  interfaceLanguage: InterfaceLanguage;
  targetLanguage: TargetLanguage;
  transcriptionLanguage: TranscriptionLanguage;
  supportLanguage: SupportLanguage;
  languageMode: UserSettings["languageMode"];
  supportLanguageMode: UserSettings["supportLanguageMode"];
  portugueseSupportLevel: PortugueseSupportLevel;
  correctionStyle: EffectiveCorrectionStyle;
  accent: EffectiveAccent;
  voice: UserSettings["preferredVoice"];
  primaryObjective: UserSettings["primaryObjective"];
  dailyMinutes: number;
  version: number;
}

export interface GenerationContext {
  interfaceLanguage: InterfaceLanguage;
  targetLanguage: TargetLanguage;
  accent: EffectiveAccent;
  correctionStyle: EffectiveCorrectionStyle;
  portugueseSupportLevel: PortugueseSupportLevel;
  preferencesVersion: number;
  promptVersion: number;
}

const validVoices: Array<UserSettings["preferredVoice"]> = [
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

const resolveInterfaceLanguage = (settings: Partial<UserSettings>): InterfaceLanguage => {
  if (settings.interfaceLanguage === "en" || settings.interfaceLanguage === "pt-BR") {
    return settings.interfaceLanguage;
  }

  return settings.languageMode === "full_english" ? "en" : "pt-BR";
};

const resolvePortugueseSupportLevel = (mode?: UserSettings["supportLanguageMode"]): PortugueseSupportLevel => {
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

const resolveAccent = (accent?: UserSettings["preferredAccent"]): EffectiveAccent =>
  accent === "british" ? "british" : "american";

const resolveTargetLanguage = (accent: EffectiveAccent): TargetLanguage =>
  accent === "british" ? "en-GB" : "en-US";

const resolveVoice = (voice?: UserSettings["preferredVoice"]): UserSettings["preferredVoice"] =>
  validVoices.includes(voice ?? "alloy") ? voice ?? "alloy" : "alloy";

export const defaultEffectiveLearningPreferences = (userId = ""): EffectiveLearningPreferences => {
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
    version: LEARNING_PREFERENCES_VERSION,
  };
};

export const resolveEffectiveLearningPreferences = (
  settings: Partial<UserSettings> | null | undefined
): EffectiveLearningPreferences => {
  const base = defaultEffectiveLearningPreferences(settings?.userId);
  const accent = resolveAccent(settings?.preferredAccent);
  const languageMode =
    settings?.languageMode === "full_english" || settings?.languageMode === "pt_explanation_en_correction"
      ? settings.languageMode
      : base.languageMode;
  const supportLanguageMode =
    settings?.supportLanguageMode === "full_portuguese_support" ||
    settings?.supportLanguageMode === "moderate_support" ||
    settings?.supportLanguageMode === "guided_immersion" ||
    settings?.supportLanguageMode === "english_only"
      ? settings.supportLanguageMode
      : base.supportLanguageMode;
  const correctionStyle =
    settings?.correctionStyle === "direct" ||
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

export const buildGenerationContext = (
  preferences: EffectiveLearningPreferences,
  promptVersion: number
): GenerationContext => ({
  interfaceLanguage: preferences.interfaceLanguage,
  targetLanguage: preferences.targetLanguage,
  accent: preferences.accent,
  correctionStyle: preferences.correctionStyle,
  portugueseSupportLevel: preferences.portugueseSupportLevel,
  preferencesVersion: preferences.version,
  promptVersion,
});

export class LearningPreferencesService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getEffectivePreferences(userId: string): Promise<EffectiveLearningPreferences> {
    const settings = await this.settingsRepository.findOrCreate(userId);
    return resolveEffectiveLearningPreferences(settings);
  }

  async getGenerationContext(userId: string, promptVersion: number) {
    return buildGenerationContext(await this.getEffectivePreferences(userId), promptVersion);
  }
}
