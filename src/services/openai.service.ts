import OpenAI, { toFile } from "openai";
import { env } from "../config/env";
import { AiRepository } from "../repositories/ai.repository";
import { SettingsRepository, UserSettings } from "../repositories/settings.repository";

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
  audioBase64: string;
  audioMimeType?: string;
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
  mode: "ai" | "preview";
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
    readonly statusCode = 503
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

const buildPreviewSpeakingCoachAnalysis = (input: Pick<SpeakingCoachInput, "targetPhrase">): SpeakingCoachAnalysis => ({
  overallScore: 72,
  mode: "preview",
  metrics: [
    { label: "Pronunciation Score", value: 74 },
    { label: "Naturalness", value: 66 },
    { label: "Connected Speech", value: 62 },
    { label: "Stress", value: 70 },
    { label: "Intonation", value: 68 },
    { label: "Rhythm", value: 65 },
    { label: "Fluency", value: 76 },
  ],
  feedback: [
    {
      title: "Voce pode estar pronunciando palavra por palavra.",
      whatHappened:
        "A gravacao foi recebida, mas a analise acustica real ainda depende da OpenAI configurada no backend.",
      whyItHappens:
        "Brasileiros geralmente aprendem ingles lendo, entao tendem a separar palavras que nativos conectam em blocos.",
      whenToUse:
        "Use connected speech em conversas naturais, respostas rapidas e reunioes informais.",
      whenToAvoid:
        "Evite reduzir demais em entrevistas formais, apresentacoes ou quando precisar falar muito claramente.",
      drill: "Treine a frase em blocos curtos antes de falar tudo: I wanna / talk about / my routine.",
    },
  ],
  strengths: ["Voce completou o ciclo de escutar, gravar e revisar.", "A frase alvo foi praticada em voz alta."],
  improvements: ["Conectar palavras em blocos.", "Dar mais peso nas palavras principais.", "Evitar ritmo silabico demais."],
  nextMission: "Repetir a frase com connected speech e stress em palavras de conteudo.",
  nextPhrase: input.targetPhrase.includes("going")
    ? "Did you kind of finish it already?"
    : "I am going to check it after lunch.",
  patterns: [
    {
      title: "Connected speech",
      evidence: "Treinar reducoes como want to -> wanna e going to -> gonna.",
      exercise: "Alternar versao clara e natural: want to / wanna.",
    },
    {
      title: "Stress uniforme",
      evidence: "A tendencia esperada e colocar energia parecida em todas as palavras.",
      exercise: "Escolher 2 palavras fortes por frase e reduzir o resto.",
    },
  ],
});

const normalizeWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);

const countWords = (text: string) => normalizeWords(text).length;

const findDifferentWords = (expectedText: string, transcribedText: string) => {
  const expected = new Set(normalizeWords(expectedText));

  return normalizeWords(transcribedText)
    .filter((word) => !expected.has(word))
    .slice(0, 12);
};

const metricsToMap = (metrics: SpeakingCoachAnalysis["metrics"]) =>
  metrics.reduce<Record<string, number>>((acc, metric) => {
    acc[metric.label] = metric.value;
    return acc;
  }, {});

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
      const response = await this.client.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: `${basePrompt}\n${instructions}`,
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
      return buildPreviewSpeakingCoachAnalysis(input);
    }

    try {
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      const audioFile = await toFile(audioBuffer, "speaking-coach.webm", {
        type: input.audioMimeType ?? "audio/webm",
      });
      const transcription = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: "gpt-4o-mini-transcribe",
        language: "en",
        prompt: `Target phrase: ${input.targetPhrase}`,
      });

      const result = await this.createJsonResponse<SpeakingCoachAnalysis>({
        mode: "speaking-coach",
        instructions: `
Voce e um professor particular de pronuncia para brasileiros aprendendo ingles.
Analise a tentativa do aluno comparando a transcricao com a frase alvo, mas nunca entregue apenas transcricao.
Ensine como um professor experiente: explique o que aconteceu, por que acontece, quando usar e quando evitar.
Foque em pronuncia, ritmo, stress, intonacao, connected speech, naturalidade e fluencia.
Use exemplos naturais como want to -> wanna, going to -> gonna, did you -> didja, kind of -> kinda, out of -> outta, I don't know -> I dunno quando forem relevantes.
Nunca diga apenas "errado". Sempre ensine.
Preferencia do usuario:
- languageMode: ${settings.languageMode}
- supportLanguageMode: ${settings.supportLanguageMode}
- preferredAccent: ${settings.preferredAccent}
- correctionStyle: ${settings.correctionStyle}
- primaryObjective: ${settings.primaryObjective}
Se languageMode for "pt_explanation_en_correction", escreva explicacoes pedagogicas em portugues brasileiro claro, mas mantenha correction, naturalSuggestion, frases de fala e exemplos em ingles.
Se languageMode for "full_english", escreva tudo em ingles simples, nivel A1/A2.
Retorne JSON valido exatamente neste formato:
{
  "overallScore": 0,
  "metrics": [
    {"label":"Pronunciation Score","value":0},
    {"label":"Naturalness","value":0},
    {"label":"Connected Speech","value":0},
    {"label":"Stress","value":0},
    {"label":"Intonation","value":0},
    {"label":"Rhythm","value":0},
    {"label":"Fluency","value":0}
  ],
  "feedback": [
    {
      "title":"feedback curto",
      "whatHappened":"explicacao curta",
      "whyItHappens":"explicacao curta",
      "whenToUse":"quando usar",
      "whenToAvoid":"quando evitar",
      "drill":"exercicio pratico"
    }
  ],
  "strengths":["ponto forte"],
  "improvements":["ponto para melhorar"],
  "nextMission":"proxima missao",
  "nextPhrase":"outra frase semelhante para praticar",
  "patterns":[{"title":"padrao","evidence":"evidencia","exercise":"exercicio"}],
  "mode":"ai"
}
`,
        userContent: JSON.stringify({
          targetPhrase: input.targetPhrase,
          transcriptFromAudio: transcription.text,
          focus: input.focus,
          context: input.context,
          level: input.level ?? "A1",
        }),
      });

      const metrics = metricsToMap(result.metrics);
      const correctedWords = findDifferentWords(input.targetPhrase, transcription.text);
      await this.aiRepository.saveSpeakingAttempt({
        userId: input.userId,
        expectedText: input.targetPhrase,
        transcribedText: transcription.text,
        pronunciationScore: metrics["Pronunciation Score"] ?? result.overallScore,
        naturalnessScore: metrics.Naturalness ?? result.overallScore,
        connectedSpeechScore: metrics["Connected Speech"] ?? result.overallScore,
        stressScore: metrics.Stress ?? result.overallScore,
        intonationScore: metrics.Intonation ?? result.overallScore,
        rhythmScore: metrics.Rhythm ?? result.overallScore,
        fluencyScore: metrics.Fluency ?? result.overallScore,
        wordsSpokenCount: countWords(transcription.text),
        correctedWords,
        feedback: result.feedback,
        suggestion: result.nextPhrase,
      });

      return {
        ...result,
        mode: "ai",
      };
    } catch (error) {
      console.error("[ai:speaking-coach] analysis failed", error instanceof Error ? error.message : error);
      return buildPreviewSpeakingCoachAnalysis(input);
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
