const englishStopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "can",
  "could",
  "for",
  "have",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "need",
  "of",
  "on",
  "please",
  "that",
  "the",
  "this",
  "to",
  "want",
  "we",
  "will",
  "with",
  "you",
]);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const words = (value: string) => normalize(value).split(/\s+/).filter(Boolean);

export type TranslationValidationReason =
  | "missing_translation"
  | "same_as_source"
  | "contains_source_english"
  | "mostly_english"
  | "invalid_payload";

export interface TranslationValidationResult {
  valid: boolean;
  reason?: TranslationValidationReason;
}

export class TranslationValidationError extends Error {
  constructor(readonly reason: TranslationValidationReason, message: string) {
    super(message);
  }
}

export const validatePortugueseTranslation = (
  sourceEnglish: string,
  translation: unknown
): TranslationValidationResult => {
  if (typeof translation !== "string") {
    return { valid: false, reason: "invalid_payload" };
  }

  const trimmed = translation.trim();
  if (!trimmed) {
    return { valid: false, reason: "missing_translation" };
  }

  const source = normalize(sourceEnglish);
  const target = normalize(trimmed);
  if (source && source === target) {
    return { valid: false, reason: "same_as_source" };
  }

  if (source && target.includes(source)) {
    return { valid: false, reason: "contains_source_english" };
  }

  const sourceContentWords = words(sourceEnglish).filter((word) => word.length > 2 && !englishStopWords.has(word));
  const targetWords = words(trimmed).filter((word) => word.length > 2);
  if (sourceContentWords.length > 0 && targetWords.length > 0) {
    const copiedSourceWords = sourceContentWords.filter((word) => targetWords.includes(word));
    const copiedRatio = copiedSourceWords.length / sourceContentWords.length;

    if (
      (sourceContentWords.length <= 2 && copiedSourceWords.length > 0) ||
      copiedSourceWords.length >= 2 ||
      copiedRatio >= 0.5
    ) {
      return { valid: false, reason: "contains_source_english" };
    }
  }

  if (targetWords.length >= 4) {
    const englishLikeCount = targetWords.filter((word) => englishStopWords.has(word)).length;
    if (englishLikeCount / targetWords.length > 0.55) {
      return { valid: false, reason: "mostly_english" };
    }
  }

  return { valid: true };
};

export const assertPortugueseTranslation = (sourceEnglish: string, translation: unknown) => {
  const result = validatePortugueseTranslation(sourceEnglish, translation);
  if (!result.valid) {
    throw new TranslationValidationError(
      result.reason ?? "invalid_payload",
      `Invalid Portuguese translation: ${result.reason ?? "invalid_payload"}`
    );
  }
};
