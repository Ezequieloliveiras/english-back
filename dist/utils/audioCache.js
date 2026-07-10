"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDays = exports.buildAudioCacheKey = exports.createHash = exports.getAudioCachePolicy = exports.normalizeSpeechText = void 0;
const crypto_1 = __importDefault(require("crypto"));
const normalizeSpeechText = (text) => text.trim().replace(/\s+/g, " ");
exports.normalizeSpeechText = normalizeSpeechText;
const getAudioCachePolicy = (audioType) => {
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
exports.getAudioCachePolicy = getAudioCachePolicy;
const createHash = (value) => crypto_1.default.createHash("sha256").update(value).digest("hex");
exports.createHash = createHash;
const buildAudioCacheKey = (params) => {
    const normalized = {
        provider: params.provider,
        model: params.model,
        text: (0, exports.normalizeSpeechText)(params.text),
        voice: params.voice,
        speed: params.speed,
        accent: params.accent,
        language: params.language,
        audioType: params.audioType,
        version: params.version,
    };
    return `english-os-audio:${params.version}:${(0, exports.createHash)(JSON.stringify(normalized))}`;
};
exports.buildAudioCacheKey = buildAudioCacheKey;
const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};
exports.addDays = addDays;
