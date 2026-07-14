import { PhraseMeaningChunk, ShadowingItem } from "../types";

type LegacyRecord = Record<string, any>;

const translationKeys = [
  "translation",
  "translationPt",
  "translationPtBr",
  "portugueseTranslation",
  "portugueseText",
  "translatedText",
  "naturalTranslation",
] as const;

const textKeys = ["text", "phrase", "sourceText"] as const;
const explanationKeys = ["explanation", "context"] as const;

export const normalizeString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readString = (source: LegacyRecord, keys: readonly string[]) => {
  for (const key of keys) {
    const value = normalizeString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

export const normalizePhraseChunks = (chunks: unknown): PhraseMeaningChunk[] => {
  if (!Array.isArray(chunks)) {
    return [];
  }

  return chunks
    .map((chunk) => {
      if (!chunk || typeof chunk !== "object") {
        return null;
      }

      const record = chunk as LegacyRecord;
      const text = normalizeString(record.text);
      const translation = readString(record, ["translation", "meaning", "translationPt", "translationPtBr"]);

      if (!text || !translation) {
        return null;
      }

      return { text, translation };
    })
    .filter((chunk): chunk is PhraseMeaningChunk => Boolean(chunk));
};

export const buildPedagogicalExplanation = (text: string) =>
  `Use esta frase para praticar uma resposta curta e natural em inglês: "${text}".`;

export const normalizeShadowingItem = (
  item: LegacyRecord,
  fallback?: Partial<ShadowingItem> | LegacyRecord
): ShadowingItem | null => {
  const merged = { ...(fallback ?? {}), ...item };
  const text = readString(merged, textKeys);

  if (!text) {
    console.warn("TRAINING_PHRASE_INVALID_PAYLOAD", { reason: "missing_text", id: merged.id });
    return null;
  }

  const translation = readString(merged, translationKeys);
  const explanation = readString(merged, explanationKeys) ?? (translation ? buildPedagogicalExplanation(text) : null);
  const pronunciationTip = readString(merged, ["pronunciationTip", "pronunciationHint"]) ?? "Fale devagar, com ritmo natural e final claro.";
  const chunks = normalizePhraseChunks(merged.chunks);
  const importantWords = normalizePhraseChunks(merged.importantWords);

  if (!translation) {
    console.warn("TRAINING_PHRASE_TRANSLATION_MISSING", { id: merged.id, text });
  }

  return {
    id: normalizeString(merged.id) ?? text,
    text,
    translation,
    explanation,
    chunks,
    pronunciationTip,
    language: "en",
    translationLanguage: translation ? "pt-BR" : null,
    ...(normalizeString(merged.audioUrl) ? { audioUrl: normalizeString(merged.audioUrl)! } : {}),
    ...(Array.isArray(merged.words) ? { words: merged.words } : {}),
    ...(importantWords.length ? { importantWords } : {}),
    ...(normalizeString(merged.additionalExample) ? { additionalExample: normalizeString(merged.additionalExample)! } : {}),
    ...(normalizeString(merged.slowPrompt) ? { slowPrompt: normalizeString(merged.slowPrompt)! } : {}),
  };
};

export const assertPortugueseTrainingPhrase = (item: ShadowingItem) => {
  if (!normalizeString(item.text)) {
    console.warn("TRAINING_PHRASE_INVALID_PAYLOAD", { reason: "missing_text", id: item.id });
    return false;
  }

  if (!normalizeString(item.translation)) {
    console.warn("TRAINING_PHRASE_INVALID_PAYLOAD", { reason: "missing_translation", id: item.id });
    return false;
  }

  return true;
};
