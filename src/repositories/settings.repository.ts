import mongoose from "mongoose";
import { UserModel } from "../models/user.model";
import { UserSettingsModel } from "../models/userSettings.model";
import { UserGoalRepository } from "./userGoal.repository";
import { EnglishLevel } from "../types";

export type LanguageMode = "pt_explanation_en_correction" | "full_english";
export type SupportLanguageMode =
  | "full_portuguese_support"
  | "moderate_support"
  | "guided_immersion"
  | "english_only";
export type PreferredAccent = "american" | "british" | "neutral";
export type PreferredVoice =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "fable"
  | "nova"
  | "onyx"
  | "sage"
  | "shimmer"
  | "verse"
  | "marin"
  | "cedar";
export type CorrectionStyle = "gentle" | "direct" | "detailed";
export type PrimaryObjective = "conversation" | "interview" | "work" | "travel" | "technical_english";

export interface UserSettings {
  userId: string;
  languageMode: LanguageMode;
  supportLanguageMode: SupportLanguageMode;
  preferredAccent: PreferredAccent;
  preferredVoice: PreferredVoice;
  correctionStyle: CorrectionStyle;
  interfaceLanguage: "pt-BR" | "en";
  primaryObjective: PrimaryObjective;
  goalType?: PrimaryObjective;
  goalDescription?: string;
  targetLevel?: EnglishLevel;
  dailyMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const defaultSettings = (userId: string): UserSettings => ({
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

const memorySettings = new Map<string, UserSettings>();

const mapSettings = (settings: any): UserSettings => ({
  userId: String(settings.userId),
  languageMode: settings.languageMode,
  supportLanguageMode: settings.supportLanguageMode ?? "moderate_support",
  preferredAccent: settings.preferredAccent,
  preferredVoice: settings.preferredVoice ?? "alloy",
  correctionStyle: settings.correctionStyle,
  interfaceLanguage: settings.interfaceLanguage,
  primaryObjective: settings.primaryObjective,
  goalType: settings.goalType ?? settings.primaryObjective,
  goalDescription: settings.goalDescription ?? "",
  targetLevel: settings.targetLevel ?? "B1",
  dailyMinutes: settings.dailyMinutes,
  createdAt: settings.createdAt?.toISOString?.(),
  updatedAt: settings.updatedAt?.toISOString?.(),
});

const coerceSettings = (userId: string, input: Partial<UserSettings>): UserSettings => {
  const base = defaultSettings(userId);

  return {
    userId,
    languageMode:
      input.languageMode === "full_english" || input.languageMode === "pt_explanation_en_correction"
        ? input.languageMode
        : base.languageMode,
    supportLanguageMode:
      input.supportLanguageMode === "full_portuguese_support" ||
      input.supportLanguageMode === "moderate_support" ||
      input.supportLanguageMode === "guided_immersion" ||
      input.supportLanguageMode === "english_only"
        ? input.supportLanguageMode
        : base.supportLanguageMode,
    preferredAccent:
      input.preferredAccent === "british" || input.preferredAccent === "neutral" || input.preferredAccent === "american"
        ? input.preferredAccent
        : base.preferredAccent,
    preferredVoice:
      input.preferredVoice === "ash" ||
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
        : base.preferredVoice,
    correctionStyle:
      input.correctionStyle === "direct" || input.correctionStyle === "detailed" || input.correctionStyle === "gentle"
        ? input.correctionStyle
        : base.correctionStyle,
    interfaceLanguage: input.languageMode === "full_english" ? "en" : "pt-BR",
    primaryObjective:
      input.primaryObjective === "interview" ||
      input.primaryObjective === "work" ||
      input.primaryObjective === "travel" ||
      input.primaryObjective === "technical_english" ||
      input.primaryObjective === "conversation"
        ? input.primaryObjective
        : base.primaryObjective,
    goalType:
      input.goalType === "interview" ||
      input.goalType === "work" ||
      input.goalType === "travel" ||
      input.goalType === "technical_english" ||
      input.goalType === "conversation"
        ? input.goalType
        : input.primaryObjective ?? base.goalType,
    goalDescription:
      typeof input.goalDescription === "string"
        ? input.goalDescription.trim()
        : base.goalDescription,
    targetLevel:
      input.targetLevel === "A1" ||
      input.targetLevel === "A2" ||
      input.targetLevel === "B1" ||
      input.targetLevel === "B2" ||
      input.targetLevel === "C1"
        ? input.targetLevel
        : base.targetLevel,
    dailyMinutes: Math.max(10, Math.min(45, Number(input.dailyMinutes ?? base.dailyMinutes))),
  };
};

export class SettingsRepository {
  constructor(private readonly userGoalRepository?: UserGoalRepository) {}

  async findOrCreate(userId: string) {
    if (!isDatabaseReady()) {
      const existing = memorySettings.get(userId);
      if (existing) return existing;

      const created = defaultSettings(userId);
      memorySettings.set(userId, created);
      return created;
    }

    const settings = await UserSettingsModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: defaultSettings(userId) },
      { new: true, upsert: true }
    );

    return mapSettings(settings);
  }

  async update(userId: string, input: Partial<UserSettings>) {
    const current = await this.findOrCreate(userId);
    const next = coerceSettings(userId, { ...current, ...input });

    if (!isDatabaseReady()) {
      const updated = { ...defaultSettings(userId), ...current, ...next };
      memorySettings.set(userId, updated);
      return updated;
    }

    const updated = await UserSettingsModel.findOneAndUpdate(
      { userId },
      { $set: next },
      { new: true, upsert: true }
    );

    await UserModel.findByIdAndUpdate(userId, {
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
