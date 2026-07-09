import { Schema, model } from "mongoose";

const userSettingsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
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
  },
  { timestamps: true }
);

export const UserSettingsModel = model("UserSettings", userSettingsSchema);
