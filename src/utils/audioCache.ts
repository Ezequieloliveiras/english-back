import crypto from "crypto";

export type AudioType =
  | "training_phrase"
  | "fixed_instruction"
  | "pronunciation_example"
  | "dynamic_ai_response"
  | "user_sensitive_content"
  | "unknown";

export interface AudioCacheKeyParams {
  provider: string;
  model: string;
  text: string;
  voice: string;
  speed: number;
  accent: string;
  language: string;
  audioType: AudioType;
  version: string;
}

export const normalizeSpeechText = (text: string) =>
  text.trim().replace(/\s+/g, " ");

export const getAudioCachePolicy = (audioType?: string) => {
  switch (audioType) {
    case "training_phrase":
    case "fixed_instruction":
      return { cacheable: true, ttlDays: 30 };
    case "pronunciation_example":
      return { cacheable: true, ttlDays: 15 };
    case "dynamic_ai_response":
    case "user_sensitive_content":
    default:
      return { cacheable: false, ttlDays: 0 };
  }
};

export const createHash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const buildAudioCacheKey = (params: AudioCacheKeyParams) => {
  const normalized = {
    provider: params.provider,
    model: params.model,
    text: normalizeSpeechText(params.text),
    voice: params.voice,
    speed: params.speed,
    accent: params.accent,
    language: params.language,
    audioType: params.audioType,
    version: params.version,
  };

  return `english-os-audio:${params.version}:${createHash(JSON.stringify(normalized))}`;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
