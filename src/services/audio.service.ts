import { env } from "../config/env";

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

const buildOpenAiSpeechInstructions = (speed: number) => {
  if (speed < 0.85) {
    return "Speak slowly, clearly, and naturally for an English beginner practicing shadowing.";
  }

  if (speed > 1.15) {
    return "Speak a little faster than normal while keeping clear pronunciation and natural rhythm.";
  }

  return "Speak with natural rhythm, clear pronunciation, and a friendly English coaching tone.";
};

const sanitizeProviderMessage = (message: string) =>
  message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-api-key]")
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[redacted-api-key]");

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
  }) {
    const provider = input.provider as SpeechProvider;
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

  private async createOpenAiSpeech(input: { text: string; voice?: string; speed: number }) {
    if (!env.openAiApiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAI voice");
    }

    const voice = providerVoices.openai.includes(input.voice ?? "") ? input.voice : "alloy";
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
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
