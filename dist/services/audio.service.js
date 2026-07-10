"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = exports.AudioProviderError = void 0;
const env_1 = require("../config/env");
const openai_1 = __importStar(require("openai"));
const audioStorage_service_1 = require("./audioStorage.service");
const audioCache_1 = require("../utils/audioCache");
const providerVoices = {
    openai: [
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
    ],
    google: ["en-US-Neural2-D", "en-US-Neural2-F", "en-US-Wavenet-D", "en-GB-Neural2-B"],
    custom: ["default"],
};
const clampSpeed = (speed) => Math.min(1.5, Math.max(0.6, Number(speed ?? 1)));
const buildOpenAiSpeechInstructions = (speed) => {
    if (speed < 0.85) {
        return "Speak slowly, clearly, and naturally for an English beginner practicing shadowing.";
    }
    if (speed > 1.15) {
        return "Speak a little faster than normal while keeping clear pronunciation and natural rhythm.";
    }
    return "Speak with natural rhythm, clear pronunciation, and a friendly English coaching tone.";
};
const sanitizeProviderMessage = (message) => message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-api-key]")
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[redacted-api-key]");
class AudioProviderError extends Error {
    constructor(message, statusCode = 400, provider = "audio") {
        super(message);
        this.statusCode = statusCode;
        this.provider = provider;
    }
}
exports.AudioProviderError = AudioProviderError;
class AudioService {
    constructor(audioCacheRepository, audioStorageService = new audioStorage_service_1.AudioStorageService()) {
        this.audioCacheRepository = audioCacheRepository;
        this.audioStorageService = audioStorageService;
        this.client = env_1.env.openAiApiKey ? new openai_1.default({ apiKey: env_1.env.openAiApiKey }) : null;
    }
    listProviders() {
        return {
            providers: [
                {
                    id: "browser",
                    label: "Browser",
                    voices: [],
                    speeds: [0.75, 0.9, 1, 1.15, 1.3],
                    clientSide: true,
                },
                {
                    id: "openai",
                    label: "OpenAI",
                    voices: providerVoices.openai,
                    speeds: [0.75, 0.9, 1, 1.15, 1.3],
                    clientSide: false,
                    available: Boolean(env_1.env.openAiApiKey),
                },
                {
                    id: "google",
                    label: "Google",
                    voices: providerVoices.google,
                    speeds: [0.75, 0.9, 1, 1.15, 1.3],
                    clientSide: false,
                    available: Boolean(env_1.env.voiceProviderEndpoint && env_1.env.voiceProviderApiKey),
                },
                {
                    id: "custom",
                    label: "Custom provider",
                    voices: providerVoices.custom,
                    speeds: [0.75, 0.9, 1, 1.15, 1.3],
                    clientSide: false,
                    available: Boolean(env_1.env.voiceProviderEndpoint && env_1.env.voiceProviderApiKey),
                },
            ],
        };
    }
    async createSpeech(input) {
        const provider = input.provider;
        const text = (0, audioCache_1.normalizeSpeechText)(input.text ?? "");
        const speed = clampSpeed(input.speed);
        const model = input.model || "gpt-4o-mini-tts";
        const language = input.language || "en";
        const accent = input.accent || "american";
        const audioType = input.audioType || "unknown";
        const version = input.version || "v1";
        if (!text) {
            throw new Error("Text is required");
        }
        const policy = (0, audioCache_1.getAudioCachePolicy)(audioType);
        const shouldCache = Boolean(policy.cacheable && input.cacheable !== false);
        const voice = this.resolveVoice(provider, input.voice);
        const cacheKey = (0, audioCache_1.buildAudioCacheKey)({
            provider,
            model,
            text,
            voice,
            speed,
            accent,
            language,
            audioType,
            version,
        });
        if (shouldCache && this.audioCacheRepository) {
            try {
                const cached = await this.audioCacheRepository.findValidByKey(cacheKey);
                const cachedBuffer = cached ? await this.audioStorageService.read(cached) : null;
                if (cached && cachedBuffer) {
                    console.info(`AUDIO_CACHE_HIT key=${cacheKey}`);
                    return {
                        contentType: cached.mimeType,
                        buffer: cachedBuffer,
                        cache: "HIT",
                        cacheKey,
                        cacheable: true,
                        expiresAt: cached.expiresAt,
                    };
                }
                console.info(`AUDIO_CACHE_MISS key=${cacheKey}`);
            }
            catch (error) {
                console.warn(`AUDIO_CACHE_ERROR key=${cacheKey}`, error instanceof Error ? error.message : error);
            }
        }
        else {
            console.info(`AUDIO_CACHE_BYPASS type=${audioType} key=${cacheKey}`);
        }
        const generated = provider === "openai"
            ? await this.createOpenAiSpeech({
                text,
                voice,
                speed,
                model,
            })
            : provider === "google" || provider === "custom"
                ? await this.createConfiguredProviderSpeech({
                    provider,
                    text,
                    voice,
                    speed,
                })
                : null;
        if (!generated) {
            throw new Error("Unsupported speech provider");
        }
        if (shouldCache && this.audioCacheRepository) {
            try {
                const expiresAt = (0, audioCache_1.addDays)(new Date(), policy.ttlDays);
                const stored = await this.audioStorageService.storeInMongo(generated.buffer);
                await this.audioCacheRepository.save({
                    key: cacheKey,
                    provider,
                    model,
                    textHash: (0, audioCache_1.createHash)(text),
                    textNormalized: text,
                    voice,
                    speed,
                    accent,
                    language,
                    audioType,
                    mimeType: generated.contentType,
                    expiresAt,
                    ...stored,
                });
                console.info(`AUDIO_CACHE_SAVE key=${cacheKey}`);
                return {
                    ...generated,
                    cache: "MISS",
                    cacheKey,
                    cacheable: true,
                    expiresAt,
                };
            }
            catch (error) {
                console.warn(`AUDIO_CACHE_ERROR key=${cacheKey}`, error instanceof Error ? error.message : error);
            }
        }
        return {
            ...generated,
            cache: shouldCache ? "MISS" : "BYPASS",
            cacheKey,
            cacheable: false,
        };
    }
    async createAlignedSpeech(input) {
        if (!this.client) {
            throw new Error("OPENAI_API_KEY is required for word-level audio alignment");
        }
        const generated = await this.createSpeech({
            ...input,
            provider: input.provider || "openai",
            audioType: input.audioType || "training_phrase",
            cacheable: input.cacheable ?? true,
        });
        const audioFile = await (0, openai_1.toFile)(generated.buffer, "aligned-speech.mp3", {
            type: generated.contentType,
        });
        const transcription = await this.client.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: input.language || "en",
            response_format: "verbose_json",
            timestamp_granularities: ["word"],
        });
        const words = (transcription.words ?? []).map((word) => ({
            word: String(word.word ?? ""),
            start: Number(word.start ?? 0),
            end: Number(word.end ?? 0),
        })).filter((word) => word.word && word.end >= word.start);
        return {
            ...generated,
            words,
        };
    }
    resolveVoice(provider, voice) {
        if (provider === "openai") {
            return providerVoices.openai.includes(voice ?? "") ? voice ?? "alloy" : "alloy";
        }
        if (provider === "google") {
            return providerVoices.google.includes(voice ?? "") ? voice ?? providerVoices.google[0] : providerVoices.google[0];
        }
        return voice || "default";
    }
    async createOpenAiSpeech(input) {
        if (!env_1.env.openAiApiKey) {
            throw new Error("OPENAI_API_KEY is required for OpenAI voice");
        }
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env_1.env.openAiApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: input.model,
                voice: input.voice,
                input: input.text,
                instructions: buildOpenAiSpeechInstructions(input.speed),
                response_format: "mp3",
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            let message = errorText;
            try {
                const payload = JSON.parse(errorText);
                message = payload.error?.message ?? payload.error?.code ?? errorText;
            }
            catch {
                message = errorText;
            }
            const sanitizedMessage = sanitizeProviderMessage(message);
            console.error(`[audio:openai] ${response.status} ${sanitizedMessage}`);
            if (response.status === 401) {
                throw new AudioProviderError("OpenAI voice is not configured correctly. Please update OPENAI_API_KEY on the backend.", 401, "openai");
            }
            if (response.status === 429) {
                throw new AudioProviderError("OpenAI voice is temporarily unavailable because the API quota or billing limit was reached.", 429, "openai");
            }
            throw new AudioProviderError(`OpenAI speech failed (${response.status})`, response.status, "openai");
        }
        return {
            contentType: "audio/mpeg",
            buffer: Buffer.from(await response.arrayBuffer()),
        };
    }
    async createConfiguredProviderSpeech(input) {
        if (!env_1.env.voiceProviderEndpoint || !env_1.env.voiceProviderApiKey) {
            throw new Error(`${input.provider} voice provider is not configured`);
        }
        const response = await fetch(env_1.env.voiceProviderEndpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env_1.env.voiceProviderApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
        });
        if (!response.ok) {
            throw new Error(`${input.provider} speech generation failed`);
        }
        return {
            contentType: response.headers.get("content-type") ?? "audio/mpeg",
            buffer: Buffer.from(await response.arrayBuffer()),
        };
    }
}
exports.AudioService = AudioService;
