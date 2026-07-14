import { env } from "../config/env";
import OpenAI, { toFile } from "openai";
import { AudioCacheRepository } from "../repositories/audioCache.repository";
import { AudioStorageService } from "./audioStorage.service";
import { LearningPreferencesService } from "./learningPreferences.service";
import {
  AudioType,
  addDays,
  buildAudioCacheKey,
  createHash,
  getAudioCachePolicy,
  normalizeSpeechText,
} from "../utils/audioCache";

export type SpeechProvider = "openai" | "google" | "custom";

const providerVoices: Record<SpeechProvider, string[]> = {
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

const clampSpeed = (speed?: number) => Math.min(1.5, Math.max(0.6, Number(speed ?? 1)));

const buildOpenAiSpeechInstructions = (speed: number, accent = "american") => {
  const accentInstruction = accent === "british" ? " Use a clear British English accent." : " Use a clear American English accent.";
  if (speed < 0.85) {
    return `Speak slowly, clearly, and naturally for an English beginner practicing shadowing.${accentInstruction}`;
  }

  if (speed > 1.15) {
    return `Speak a little faster than normal while keeping clear pronunciation and natural rhythm.${accentInstruction}`;
  }

  return `Speak with natural rhythm, clear pronunciation, and a friendly English coaching tone.${accentInstruction}`;
};

const sanitizeProviderMessage = (message: string) =>
  message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-api-key]")
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[redacted-api-key]");

type TimedWord = {
  word: string;
  start: number;
  end: number;
};

const normalizeTimedWords = (input: unknown): TimedWord[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const word = typeof candidate.word === "string" ? candidate.word : "";
      const start = Number(candidate.start);
      const end = Number(candidate.end);

      if (!word || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return null;
      }

      return { word, start, end };
    })
    .filter((item): item is TimedWord => item !== null)
    .sort((a, b) => a.start - b.start);
};

export class AudioProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly provider = "audio"
  ) {
    super(message);
  }
}

export class AudioService {
  private readonly client = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;

  constructor(
    private readonly audioCacheRepository?: AudioCacheRepository,
    private readonly audioStorageService = new AudioStorageService(),
    private readonly learningPreferencesService?: LearningPreferencesService
  ) {}

  listProviders() {
    return {
      providers: [
        {
          id: "openai",
          label: "OpenAI",
          voices: providerVoices.openai,
          speeds: [0.75, 0.9, 1, 1.15, 1.3],
          clientSide: false,
          available: Boolean(env.openAiApiKey),
        },
        {
          id: "google",
          label: "Google",
          voices: providerVoices.google,
          speeds: [0.75, 0.9, 1, 1.15, 1.3],
          clientSide: false,
          available: Boolean(env.voiceProviderEndpoint && env.voiceProviderApiKey),
        },
        {
          id: "custom",
          label: "Custom provider",
          voices: providerVoices.custom,
          speeds: [0.75, 0.9, 1, 1.15, 1.3],
          clientSide: false,
          available: Boolean(env.voiceProviderEndpoint && env.voiceProviderApiKey),
        },
      ],
    };
  }

  async createSpeech(input: {
    provider?: string;
    text?: string;
    voice?: string;
    speed?: number;
    model?: string;
    language?: string;
    accent?: string;
    audioType?: AudioType;
    cacheable?: boolean;
    version?: string;
    userId?: string;
  }) {
    const preferences = input.userId && this.learningPreferencesService
      ? await this.learningPreferencesService.getEffectivePreferences(input.userId)
      : null;
    const provider = input.provider as SpeechProvider;
    const text = normalizeSpeechText(input.text ?? "");
    const speed = clampSpeed(input.speed);
    const model = input.model || "gpt-4o-mini-tts";
    const language = preferences?.targetLanguage ?? input.language ?? "en-US";
    const accent = preferences?.accent ?? (input.accent === "british" ? "british" : "american");
    const audioType = input.audioType || "unknown";
    const version = input.version || `prefs-v${preferences?.version ?? 0}`;

    if (!text) {
      throw new Error("Text is required");
    }

    const policy = getAudioCachePolicy(audioType);
    const shouldCache = Boolean(policy.cacheable && input.cacheable !== false);
    const voice = this.resolveVoice(provider, preferences?.voice ?? input.voice);
    const cacheKey = buildAudioCacheKey({
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
            cache: "HIT" as const,
            cacheKey,
            cacheable: true,
            expiresAt: cached.expiresAt,
          };
        }

        console.info(`AUDIO_CACHE_MISS key=${cacheKey}`);
      } catch (error) {
        console.warn(`AUDIO_CACHE_ERROR key=${cacheKey}`, error instanceof Error ? error.message : error);
      }
    } else {
      console.info(`AUDIO_CACHE_BYPASS type=${audioType} key=${cacheKey}`);
    }

    const generated =
      provider === "openai"
        ? await this.createOpenAiSpeech({
            text,
            voice,
            speed,
            model,
            accent,
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
        const expiresAt = addDays(new Date(), policy.ttlDays);
        const stored = await this.audioStorageService.storeInMongo(generated.buffer);
        await this.audioCacheRepository.save({
          key: cacheKey,
          provider,
          model,
          textHash: createHash(text),
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
          cache: "MISS" as const,
          cacheKey,
          cacheable: true,
          expiresAt,
        };
      } catch (error) {
        console.warn(`AUDIO_CACHE_ERROR key=${cacheKey}`, error instanceof Error ? error.message : error);
      }
    }

    return {
      ...generated,
      cache: shouldCache ? ("MISS" as const) : ("BYPASS" as const),
      cacheKey,
      cacheable: false,
    };
  }

  async createAlignedSpeech(input: {
    provider?: string;
    text?: string;
    voice?: string;
    speed?: number;
    model?: string;
    language?: string;
    accent?: string;
    audioType?: AudioType;
    cacheable?: boolean;
    version?: string;
    userId?: string;
  }) {
    const preferences = input.userId && this.learningPreferencesService
      ? await this.learningPreferencesService.getEffectivePreferences(input.userId)
      : null;
    if (!this.client) {
      throw new Error("OPENAI_API_KEY is required for word-level audio alignment");
    }

    const generated = await this.createSpeech({
      ...input,
      provider: input.provider || "openai",
      audioType: input.audioType || "training_phrase",
      cacheable: input.cacheable ?? true,
    });

    const audioFile = await toFile(generated.buffer, "aligned-speech.mp3", {
      type: generated.contentType,
    });

    const transcription = await this.client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: preferences?.transcriptionLanguage ?? input.language ?? "en",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });

    const words = normalizeTimedWords(transcription.words);

    return {
      ...generated,
      words,
    };
  }

  private resolveVoice(provider: SpeechProvider, voice?: string) {
    if (provider === "openai") {
      return providerVoices.openai.includes(voice ?? "") ? voice ?? "alloy" : "alloy";
    }

    if (provider === "google") {
      return providerVoices.google.includes(voice ?? "") ? voice ?? providerVoices.google[0] : providerVoices.google[0];
    }

    return voice || "default";
  }

  private async createOpenAiSpeech(input: { text: string; voice: string; speed: number; model: string; accent: string }) {
    if (!env.openAiApiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAI voice");
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        voice: input.voice,
        input: input.text,
        instructions: buildOpenAiSpeechInstructions(input.speed, input.accent),
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let message = errorText;

      try {
        const payload = JSON.parse(errorText) as { error?: { message?: string; code?: string } };
        message = payload.error?.message ?? payload.error?.code ?? errorText;
      } catch {
        message = errorText;
      }

      const sanitizedMessage = sanitizeProviderMessage(message);
      console.error(`[audio:openai] ${response.status} ${sanitizedMessage}`);

      if (response.status === 401) {
        throw new AudioProviderError(
          "OpenAI voice is not configured correctly. Please update OPENAI_API_KEY on the backend.",
          401,
          "openai"
        );
      }

      if (response.status === 429) {
        throw new AudioProviderError(
          "OpenAI voice is temporarily unavailable because the API quota or billing limit was reached.",
          429,
          "openai"
        );
      }

      throw new AudioProviderError(`OpenAI speech failed (${response.status})`, response.status, "openai");
    }

    return {
      contentType: "audio/mpeg",
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  }

  private async createConfiguredProviderSpeech(input: {
    provider: "google" | "custom";
    text: string;
    voice?: string;
    speed: number;
  }) {
    if (!env.voiceProviderEndpoint || !env.voiceProviderApiKey) {
      throw new Error(`${input.provider} voice provider is not configured`);
    }

    const response = await fetch(env.voiceProviderEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.voiceProviderApiKey}`,
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

