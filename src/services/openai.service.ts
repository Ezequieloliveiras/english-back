import OpenAI, { toFile } from "openai";
import { env } from "../config/env";
import { AiRepository } from "../repositories/ai.repository";
import { SettingsRepository, UserSettings } from "../repositories/settings.repository";
import {
  SpeakingCoachStatus,
  SpeakingCoachValidationError,
  comparePhraseToTranscript,
  deriveSpeakingMetrics,
  normalizeAndAnalyzeAudio,
  speakingAudioExtension,
  validateTranscriptComparison,
} from "./speakingCoachAnalysis.service";

type AiMode =
  | "conversation"
  | "dev-mode"
  | "think-in-english"
  | "vocabulary"
  | "daily-plan"
  | "speaking-coach"
  | "mistake";

interface PreviousMessage {
  role: "user" | "assistant";
  content: string;
}

interface ConversationInput {
  userId: string;
  mode: string;
  message: string;
  level?: string;
  goal?: string;
  previousMessages?: PreviousMessage[];
}

interface VocabularyInput {
  userId: string;
  topic?: string;
  level?: string;
  goal?: string;
}

interface DailyPlanInput {
  userId: string;
  level: string;
  goal: string;
  dailyMinutes: number;
  difficulty: string;
}

interface MistakeInput {
  userId: string;
  sentence: string;
  level?: string;
}

interface SpeakingCoachInput {
  userId: string;
  audioBuffer: Buffer;
  audioMimeType: string;
  targetPhrase: string;
  focus?: string;
  context?: string;
  level?: string;
}

interface MistakeAnalysis {
  originalSentence: string;
  correctedSentence: string;
  mistakeType: string;
  explanation: string;
}

interface SpeakingCoachAnalysis {
  status: SpeakingCoachStatus;
  detectedSpeech: boolean;
  transcript?: string;
  audioQuality?: {
    durationSeconds: number;
    speechRatio: number;
    volumeLevel?: number;
  };
  comparison?: {
    coverage: number;
    similarity: number;
    missingWords: string[];
    extraWords: string[];
  };
  overallScore: number;
  metrics: Array<{
    label: string;
    value: number;
  }>;
  feedback: Array<{
    title: string;
    whatHappened: string;
    whyItHappens: string;
    whenToUse: string;
    whenToAvoid: string;
    drill: string;
  }>;
  strengths: string[];
  improvements: string[];
  nextMission: string;
  nextPhrase: string;
  patterns: Array<{
    title: string;
    evidence: string;
    exercise: string;
  }>;
  mode: "ai";
}

export interface AiReply {
  reply: string;
  correction?: string;
  suggestedPhrase?: string;
  nextQuestion?: string;
  level?: string;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode = 503,
    readonly code?: string
  ) {
    super(message);
  }
}

const basePrompt = `
Voce e um professor de ingles senior com mais de 20 anos de experiencia.
Seu aluno e iniciante e precisa aprender ingles rapidamente para se comunicar.
Priorize fala, listening, frases uteis e confianca.
Corrija somente erros importantes.
Nao interrompa a fluencia por pequenos erros.
Sempre responda em ingles simples, nivel A1/A2.
Quando necessario, explique rapidamente em portugues.
Nunca de aulas longas de gramatica.
Faca perguntas curtas para manter a conversa.
Use frases naturais do dia a dia.
Quando o modo for desenvolvedor, use contexto de programacao, APIs, bugs, deploy, banco de dados, frontend, backend e reunioes tecnicas.
Retorne sempre JSON valido, sem markdown.
`;

const developerContexts = `
Developer prompts:
- explicar bug
- falar sobre API
- falar sobre deploy
- falar sobre banco de dados
- participar de daily
- explicar pull request
- falar com cliente
Use frases curtas e naturais para contexto tecnico.
`;

const parseJson = <T>(text: string): T => {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  return JSON.parse(cleaned) as T;
};

const limitMessages = (messages: PreviousMessage[] = []) => messages.slice(-8);

const normalizeWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);

const countWords = (text: string) => normalizeWords(text).length;

const metricsToMap = (metrics: SpeakingCoachAnalysis["metrics"]) =>
  metrics.reduce<Record<string, number>>((acc, metric) => {
    acc[metric.label] = metric.value;
    return acc;
  }, {});

const englishPedagogyPattern =
  /\b(you said|you pronounced|you missed|you used|you added|your pronunciation|your rhythm|your recording|good rhythm|clear pronunciation|connected speech|add the|missing word|instead of|people often|it sounds|sounds more|improve intonation|practice saying|try saying)\b/i;

const hasEnglishPedagogyWhenPortugueseNeeded = (
  settings: UserSettings,
  feedback: Pick<
    SpeakingCoachAnalysis,
    "feedback" | "strengths" | "improvements" | "nextMission" | "nextPhrase" | "patterns"
  >
) => {
  if (settings.languageMode === "full_english") {
    return false;
  }

  const texts = [
    ...(feedback.feedback ?? []).flatMap((item) => [
      item.title,
      item.whatHappened,
      item.whyItHappens,
      item.whenToUse,
      item.whenToAvoid,
      item.drill,
    ]),
    ...(feedback.strengths ?? []),
    ...(feedback.improvements ?? []),
    feedback.nextMission,
    ...(feedback.patterns ?? []).flatMap((item) => [item.evidence, item.exercise]),
  ].filter((text): text is string => typeof text === "string");

  return texts.some((text) => englishPedagogyPattern.test(text.replace(/"[^"]+"/g, "")));
};

export class OpenAiService {
  private readonly client: OpenAI | null;

  constructor(
    private readonly aiRepository: AiRepository,
    private readonly settingsRepository?: SettingsRepository
  ) {
    this.client = env.openAiApiKey
      ? new OpenAI({ apiKey: env.openAiApiKey, maxRetries: 0, timeout: 20000 })
      : null;
  }

  private async createJsonResponse<T>({
    mode,
    instructions,
    userContent,
  }: {
    mode: AiMode;
    instructions: string;
    userContent: string;
  }): Promise<T> {
    if (!this.client) {
      throw new AiProviderError("OpenAI is not configured on the backend.", 503);
    }

    try {
      const systemContent = mode === "speaking-coach" ? instructions : `${basePrompt}\n${instructions}`;
      const response = await this.client.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      });

      return parseJson<T>(response.output_text);
    } catch (error) {
      console.error(`[ai:${mode}] OpenAI request failed`, error instanceof Error ? error.message : error);

      if (error instanceof SyntaxError) {
        throw new AiProviderError("OpenAI returned an invalid structured response.", 502);
      }

      const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;

      if (status === 401) {
        throw new AiProviderError("OpenAI API key is invalid. Update OPENAI_API_KEY and restart the backend.", 401);
      }

      if (status === 429) {
        throw new AiProviderError(
          "OpenAI quota or billing limit was reached. Add API billing/credits to continue real AI conversations.",
          429
        );
      }

      if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
        throw new AiProviderError("OpenAI took too long to respond. Please try again.", 504);
      }

      throw new AiProviderError("OpenAI is unavailable right now. Please try again.", 503);
    }
  }

  private async ensureSpeakingCoachFeedbackLanguage({
    settings,
    feedback,
  }: {
    settings: UserSettings;
    feedback: Pick<
      SpeakingCoachAnalysis,
      "feedback" | "strengths" | "improvements" | "nextMission" | "nextPhrase" | "patterns"
    >;
  }) {
    if (!hasEnglishPedagogyWhenPortugueseNeeded(settings, feedback)) {
      return feedback;
    }

    const repairedFeedback = await this.createJsonResponse<
      Pick<
        SpeakingCoachAnalysis,
        "feedback" | "strengths" | "improvements" | "nextMission" | "nextPhrase" | "patterns"
      >
    >({
      mode: "speaking-coach",
      instructions: `
You will receive a JSON object with pronunciation feedback.
Rewrite the pedagogical fields in clear Brazilian Portuguese, like a private teacher explaining to a Brazilian learner.
Preserve English phrases, examples and corrections verbatim when they are quoted or are training phrases.
Do not change nextPhrase if it is in English.
Do not change the meaning, do not add scores, do not invent evidence and do not remove items.
Fields that must be in Brazilian Portuguese: title, whatHappened, whyItHappens, whenToUse, whenToAvoid, drill, strengths, improvements, nextMission, patterns.evidence and patterns.exercise.
Fields that may stay in English: quoted words/phrases, examples like "want to", "wanna" and nextPhrase.
Return valid JSON exactly in this format:
{
  "feedback": [
    {
      "title":"short feedback",
      "whatHappened":"short explanation",
      "whyItHappens":"short explanation",
      "whenToUse":"when to use it",
      "whenToAvoid":"when to avoid it",
      "drill":"practical drill"
    }
  ],
  "strengths":["strength"],
  "improvements":["improvement point"],
  "nextMission":"next mission",
  "nextPhrase":"another similar sentence to practice",
  "patterns":[{"title":"pattern","evidence":"evidence","exercise":"exercise"}]
}
`,
      userContent: JSON.stringify(feedback),
    });

    if (hasEnglishPedagogyWhenPortugueseNeeded(settings, repairedFeedback)) {
      throw new AiProviderError("OpenAI returned feedback in the wrong language. Please try again.", 502);
    }

    return repairedFeedback;
  }

  async generateConversationReply(input: ConversationInput): Promise<AiReply> {
    const reply = await this.createJsonResponse<AiReply>({
      mode: "conversation",
      instructions: `
Retorne no formato:
{"reply":"resposta curta","correction":"correcao curta se necessario","suggestedPhrase":"frase melhor","nextQuestion":"proxima pergunta curta","level":"A1"}
Modo escolhido: ${input.mode}
Nivel: ${input.level ?? "A1"}
Objetivo: ${input.goal ?? "comunicacao real"}
`,
      userContent: JSON.stringify({
        recentHistory: limitMessages(input.previousMessages),
        userMessage: input.message,
      }),
    });

    await this.persistConversation(input, reply);
    return reply;
  }

  async generateDeveloperEnglishReply(input: ConversationInput): Promise<AiReply> {
    const reply = await this.createJsonResponse<AiReply>({
      mode: "dev-mode",
      instructions: `
${developerContexts}
Retorne no formato:
{"reply":"resposta curta","correction":"correcao curta se necessario","suggestedPhrase":"frase tecnica melhor","nextQuestion":"proxima pergunta tecnica curta","level":"A1"}
Modo tecnico: ${input.mode}
Nivel: ${input.level ?? "A1"}
Objetivo: ${input.goal ?? "ingles tecnico para trabalho"}
`,
      userContent: JSON.stringify({
        recentHistory: limitMessages(input.previousMessages),
        userMessage: input.message,
      }),
    });

    await this.persistConversation({ ...input, mode: `developer:${input.mode}` }, reply);
    return reply;
  }

  async generateThinkInEnglishReply(input: ConversationInput): Promise<AiReply> {
    const reply = await this.createJsonResponse<AiReply>({
      mode: "think-in-english",
      instructions: `
Se o usuario pedir traducao palavra por palavra, incentive descricao em ingles primeiro.
Retorne no formato:
{"reply":"resposta curta em ingles simples","correction":"","suggestedPhrase":"frase util","nextQuestion":"pergunta curta","level":"A1"}
`,
      userContent: JSON.stringify({
        recentHistory: limitMessages(input.previousMessages),
        userMessage: input.message,
      }),
    });

    await this.persistConversation({ ...input, mode: "think-in-english" }, reply);
    return reply;
  }

  async generateVocabularyExamples(input: VocabularyInput) {
    return this.createJsonResponse({
      mode: "vocabulary",
      instructions: `
Crie vocabulario sempre com frases completas, nunca palavras isoladas.
Retorne:
{"topic":"tema","level":"A1","examples":[{"phrase":"frase em ingles","translation":"traducao curta","category":"categoria"}]}
`,
      userContent: JSON.stringify(input),
    });
  }

  async generateDailyPlan(input: DailyPlanInput) {
    return this.createJsonResponse({
      mode: "daily-plan",
      instructions: `
Monte uma rotina curta de ingles para hoje.
Retorne:
{"focus":"foco do dia","blocks":[{"title":"Shadowing","durationMinutes":8,"objective":"objetivo curto"}]}
Use os minutos disponiveis sem ultrapassar o total.
`,
      userContent: JSON.stringify(input),
    });
  }

  async analyzeSpeakingCoachAttempt(input: SpeakingCoachInput): Promise<SpeakingCoachAnalysis> {
    const settings = await this.getUserSettings(input.userId);

    if (!this.client) {
      throw new AiProviderError("OpenAI is not configured on the backend.", 503);
    }

    try {
      const { wavBuffer, audioQuality } = await normalizeAndAnalyzeAudio({
        buffer: input.audioBuffer,
        mimeType: input.audioMimeType,
      });
      const audioFile = await toFile(wavBuffer, `speaking-coach.${speakingAudioExtension("audio/wav")}`, {
        type: "audio/wav",
      });
      const transcription = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: "gpt-4o-mini-transcribe",
        language: "en",
      });
      const transcript = transcription.text ?? "";
      const comparison = comparePhraseToTranscript(input.targetPhrase, transcript);
      validateTranscriptComparison(transcript, audioQuality, comparison);
      const derived = deriveSpeakingMetrics(audioQuality, comparison);

      console.info("[ai:speaking-coach] validated", {
        durationSeconds: audioQuality.durationSeconds,
        speechRatio: audioQuality.speechRatio,
        words: comparison.spokenWords.length,
        coverage: comparison.coverage,
        status: "ok",
      });

      const feedbackResult = await this.createJsonResponse<
        Pick<SpeakingCoachAnalysis, "feedback" | "strengths" | "improvements" | "nextMission" | "nextPhrase" | "patterns">
      >({
        mode: "speaking-coach",
        instructions: `
You are a private English pronunciation teacher for Brazilian learners.
Use ONLY the real evidence provided. Do not invent acoustic data.
The scores were already calculated deterministically. Do not return scores.
Teach like an experienced coach: explain what happened, why it happens, when to use it and when to avoid it.
Focus on what is supported by the transcript, target coverage, missing/extra words, duration, volume and speech ratio.
Use natural examples such as want to -> wanna, going to -> gonna, did you -> didja, kind of -> kinda, out of -> outta, I don't know -> I dunno when relevant.
Never just say "wrong". Always teach.
User preferences:
- languageMode: ${settings.languageMode}
- supportLanguageMode: ${settings.supportLanguageMode}
- preferredAccent: ${settings.preferredAccent}
- correctionStyle: ${settings.correctionStyle}
- primaryObjective: ${settings.primaryObjective}
If languageMode is "pt_explanation_en_correction": write pedagogical explanations in clear Brazilian Portuguese, but keep corrections, spoken phrases and examples in English.
If languageMode is "full_english": write everything in simple A1/A2 English, including titles, subtitles, explanations, strengths, improvements, nextMission and patterns.
For Brazilian Portuguese mode, these pedagogical fields must be in Brazilian Portuguese:
title, whatHappened, whyItHappens, whenToUse, whenToAvoid, drill, strengths, improvements, nextMission, patterns.evidence and patterns.exercise.
Keep only literal quoted English phrases in English, such as "want to", "wanna" and "I wanna talk about my routine.".
In Brazilian Portuguese mode, do not write phrases like "You said", "Good rhythm", "Practice..." outside quoted examples; write them in Portuguese, like "Você disse...", "Bom ritmo...", "Pratique...".
Return valid JSON exactly in this format:
{
  "feedback": [
    {
      "title":"short feedback",
      "whatHappened":"short explanation",
      "whyItHappens":"short explanation",
      "whenToUse":"when to use it",
      "whenToAvoid":"when to avoid it",
      "drill":"practical drill"
    }
  ],
  "strengths":["strength"],
  "improvements":["improvement point"],
  "nextMission":"next mission",
  "nextPhrase":"another similar sentence to practice",
  "patterns":[{"title":"pattern","evidence":"evidence","exercise":"exercise"}]
}
`,
        userContent: JSON.stringify({
          targetPhrase: input.targetPhrase,
          transcriptFromAudio: transcript,
          audioQuality,
          comparison: {
            coverage: comparison.coverage,
            similarity: comparison.similarity,
            wordErrorRate: comparison.wordErrorRate,
            missingWords: comparison.missingWords,
            extraWords: comparison.extraWords,
          },
          deterministicScores: derived,
          focus: input.focus,
          context: input.context,
          level: input.level ?? "A1",
        }),
      });
      const localizedFeedbackResult = await this.ensureSpeakingCoachFeedbackLanguage({
        settings,
        feedback: feedbackResult,
      });

      const result: SpeakingCoachAnalysis = {
        status: "ok",
        detectedSpeech: true,
        transcript,
        audioQuality: {
          durationSeconds: audioQuality.durationSeconds,
          speechRatio: audioQuality.speechRatio,
          volumeLevel: audioQuality.rms,
        },
        comparison: {
          coverage: comparison.coverage,
          similarity: comparison.similarity,
          missingWords: comparison.missingWords,
          extraWords: comparison.extraWords,
        },
        overallScore: derived.overallScore,
        metrics: derived.metrics,
        feedback: localizedFeedbackResult.feedback ?? [],
        strengths: localizedFeedbackResult.strengths ?? [],
        improvements: localizedFeedbackResult.improvements ?? [],
        nextMission: localizedFeedbackResult.nextMission ?? "Repita a frase mantendo clareza e ritmo natural.",
        nextPhrase: localizedFeedbackResult.nextPhrase ?? input.targetPhrase,
        patterns: localizedFeedbackResult.patterns ?? [],
        mode: "ai",
      };
      const localizedResult = result;
      const metrics = metricsToMap(localizedResult.metrics);
      const correctedWords = comparison.missingWords.slice(0, 12);
      await this.aiRepository.saveSpeakingAttempt({
        userId: input.userId,
        expectedText: input.targetPhrase,
        transcribedText: transcript,
        pronunciationScore: metrics["Pronunciation Score"] ?? localizedResult.overallScore,
        naturalnessScore: metrics.Naturalness ?? localizedResult.overallScore,
        connectedSpeechScore: metrics["Connected Speech"] ?? localizedResult.overallScore,
        stressScore: metrics.Stress ?? localizedResult.overallScore,
        intonationScore: metrics.Intonation ?? localizedResult.overallScore,
        rhythmScore: metrics.Rhythm ?? localizedResult.overallScore,
        fluencyScore: metrics.Fluency ?? localizedResult.overallScore,
        wordsSpokenCount: countWords(transcript),
        correctedWords,
        feedback: localizedResult.feedback,
        suggestion: localizedResult.nextPhrase,
        durationSeconds: audioQuality.durationSeconds,
        speechRatio: audioQuality.speechRatio,
        transcriptCoverage: comparison.coverage,
        transcriptSimilarity: comparison.similarity,
        analysisProvider: "openai",
        analysisModel: "gpt-4o-mini-transcribe+deterministic",
        audioMimeType: input.audioMimeType,
        status: "ok",
      });

      return {
        ...localizedResult,
        mode: "ai",
      };
    } catch (error) {
      console.error("[ai:speaking-coach] analysis failed", error instanceof Error ? error.message : error);
      if (error instanceof SpeakingCoachValidationError) {
        throw new AiProviderError(error.message, error.statusCode, error.status);
      }
      const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
      if (status === 401) {
        throw new AiProviderError("OpenAI API key is invalid. Update OPENAI_API_KEY and restart the backend.", 401);
      }
      if (status === 429) {
        throw new AiProviderError("OpenAI quota or billing limit was reached. Add API billing/credits to continue.", 429);
      }
      if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
        throw new AiProviderError("OpenAI took too long to respond. Please try again.", 504);
      }
      throw error;
    }
  }

  private async getUserSettings(userId: string): Promise<UserSettings> {
    if (!this.settingsRepository) {
      return {
        userId,
        languageMode: "pt_explanation_en_correction",
        supportLanguageMode: "moderate_support",
        preferredAccent: "american",
        correctionStyle: "gentle",
        interfaceLanguage: "pt-BR",
        primaryObjective: "conversation",
        dailyMinutes: 20,
      };
    }

    return this.settingsRepository.findOrCreate(userId);
  }

  async analyzeStudentMistake(input: MistakeInput) {
    const result = await this.createJsonResponse<MistakeAnalysis>({
      mode: "mistake",
      instructions: `
Analise apenas erros importantes para comunicacao.
Retorne:
{"originalSentence":"frase original","correctedSentence":"frase corrigida","mistakeType":"tipo do erro","explanation":"explicacao curta em portugues"}
`,
      userContent: JSON.stringify(input),
    });

    await this.aiRepository.saveMistake({
      userId: input.userId,
      originalSentence: result.originalSentence,
      correctedSentence: result.correctedSentence,
      mistakeType: result.mistakeType,
      explanation: result.explanation,
    });

    return result;
  }

  private async persistConversation(input: ConversationInput, reply: AiReply) {
    await this.aiRepository.saveConversationTurn({
      userId: input.userId,
      mode: input.mode,
      userMessage: input.message,
      assistantMessage: reply.reply,
      correction: reply.correction,
      suggestedPhrase: reply.suggestedPhrase,
    });

    if (reply.correction && reply.suggestedPhrase) {
      await this.aiRepository.saveMistake({
        userId: input.userId,
        originalSentence: input.message,
        correctedSentence: reply.suggestedPhrase,
        mistakeType: "important correction",
        explanation: reply.correction,
      });
    }
  }
}
