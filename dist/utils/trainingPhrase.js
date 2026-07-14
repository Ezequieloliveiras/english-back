"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertPortugueseTrainingPhrase = exports.normalizeShadowingItem = exports.buildPedagogicalExplanation = exports.normalizePhraseChunks = exports.normalizeString = void 0;
const translationKeys = [
    "translation",
    "translationPt",
    "translationPtBr",
    "portugueseTranslation",
    "portugueseText",
    "translatedText",
    "naturalTranslation",
];
const textKeys = ["text", "phrase", "sourceText"];
const explanationKeys = ["explanation", "context"];
const normalizeString = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};
exports.normalizeString = normalizeString;
const readString = (source, keys) => {
    for (const key of keys) {
        const value = (0, exports.normalizeString)(source[key]);
        if (value) {
            return value;
        }
    }
    return null;
};
const normalizePhraseChunks = (chunks) => {
    if (!Array.isArray(chunks)) {
        return [];
    }
    return chunks
        .map((chunk) => {
        if (!chunk || typeof chunk !== "object") {
            return null;
        }
        const record = chunk;
        const text = (0, exports.normalizeString)(record.text);
        const translation = readString(record, ["translation", "meaning", "translationPt", "translationPtBr"]);
        if (!text || !translation) {
            return null;
        }
        return { text, translation };
    })
        .filter((chunk) => Boolean(chunk));
};
exports.normalizePhraseChunks = normalizePhraseChunks;
const buildPedagogicalExplanation = (text) => `Use esta frase para praticar uma resposta curta e natural em inglês: "${text}".`;
exports.buildPedagogicalExplanation = buildPedagogicalExplanation;
const normalizeShadowingItem = (item, fallback) => {
    const merged = { ...(fallback ?? {}), ...item };
    const text = readString(merged, textKeys);
    if (!text) {
        console.warn("TRAINING_PHRASE_INVALID_PAYLOAD", { reason: "missing_text", id: merged.id });
        return null;
    }
    const translation = readString(merged, translationKeys);
    const explanation = readString(merged, explanationKeys) ?? (translation ? (0, exports.buildPedagogicalExplanation)(text) : null);
    const pronunciationTip = readString(merged, ["pronunciationTip", "pronunciationHint"]) ?? "Fale devagar, com ritmo natural e final claro.";
    const chunks = (0, exports.normalizePhraseChunks)(merged.chunks);
    const importantWords = (0, exports.normalizePhraseChunks)(merged.importantWords);
    if (!translation) {
        console.warn("TRAINING_PHRASE_TRANSLATION_MISSING", { id: merged.id, text });
    }
    return {
        id: (0, exports.normalizeString)(merged.id) ?? text,
        text,
        translation,
        explanation,
        chunks,
        pronunciationTip,
        language: "en",
        translationLanguage: translation ? "pt-BR" : null,
        ...((0, exports.normalizeString)(merged.audioUrl) ? { audioUrl: (0, exports.normalizeString)(merged.audioUrl) } : {}),
        ...(Array.isArray(merged.words) ? { words: merged.words } : {}),
        ...(importantWords.length ? { importantWords } : {}),
        ...((0, exports.normalizeString)(merged.additionalExample) ? { additionalExample: (0, exports.normalizeString)(merged.additionalExample) } : {}),
        ...((0, exports.normalizeString)(merged.slowPrompt) ? { slowPrompt: (0, exports.normalizeString)(merged.slowPrompt) } : {}),
    };
};
exports.normalizeShadowingItem = normalizeShadowingItem;
const assertPortugueseTrainingPhrase = (item) => {
    if (!(0, exports.normalizeString)(item.text)) {
        console.warn("TRAINING_PHRASE_INVALID_PAYLOAD", { reason: "missing_text", id: item.id });
        return false;
    }
    if (!(0, exports.normalizeString)(item.translation)) {
        console.warn("TRAINING_PHRASE_INVALID_PAYLOAD", { reason: "missing_translation", id: item.id });
        return false;
    }
    return true;
};
exports.assertPortugueseTrainingPhrase = assertPortugueseTrainingPhrase;
