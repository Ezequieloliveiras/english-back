"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = exports.AudioProviderError = void 0;
const env_1 = require("../config/env");
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
        const text = input.text?.trim();
        if (!text) {
            throw new Error("Text is required");
        }
        if (provider === "openai") {
            return this.createOpenAiSpeech({
                text,
                voice: input.voice,
                speed: clampSpeed(input.speed),
            });
        }
        if (provider === "google" || provider === "custom") {
            return this.createConfiguredProviderSpeech({
                provider,
                text,
                voice: input.voice,
                speed: clampSpeed(input.speed),
            });
        }
        throw new Error("Unsupported speech provider");
    }
    async createOpenAiSpeech(input) {
        if (!env_1.env.openAiApiKey) {
            throw new Error("OPENAI_API_KEY is required for OpenAI voice");
        }
        const voice = providerVoices.openai.includes(input.voice ?? "") ? input.voice : "alloy";
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env_1.env.openAiApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini-tts",
                voice,
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
