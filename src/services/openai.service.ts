import OpenAI from "openai";
import { dashboardMock } from "../data/mockData";
import { env } from "../config/env";
import { AiRepository } from "../repositories/ai.repository";

type AiMode = "conversation" | "dev-mode" | "think-in-english" | "vocabulary" | "daily-plan" | "mistake";

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

export interface AiReply {
  reply: string;
  correction?: string;
  suggestedPhrase?: string;
  nextQuestion?: string;
  level?: string;
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

const fallbackConversation = (mode: string): AiReply => ({
  reply: `Good. Let us practice ${mode} with simple English. Say one short sentence about your situation.`,
  correction: "",
  suggestedPhrase: "I am working on this today.",
  nextQuestion: "What is one thing you need to explain?",
  level: "A1",
});

const safeParseJson = <T>(text: string, fallback: T): T => {
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    return { ...fallback, ...JSON.parse(cleaned) };
  } catch {
    return fallback;
  }
};

const limitMessages = (messages: PreviousMessage[] = []) => messages.slice(-8);

export class OpenAiService {
  private readonly client: OpenAI | null;

  constructor(private readonly aiRepository: AiRepository) {
    this.client = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;
  }

  private async createJsonResponse<T>({
    mode,
    instructions,
    userContent,
    fallback,
  }: {
    mode: AiMode;
    instructions: string;
    userContent: string;
    fallback: T;
  }): Promise<T> {
    if (!this.client) {
      console.warn(`[ai:${mode}] OPENAI_API_KEY missing. Using fallback.`);
      return fallback;
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

      return safeParseJson(response.output_text, fallback);
    } catch (error) {
      console.error(`[ai:${mode}] OpenAI request failed`, error instanceof Error ? error.message : error);
      return fallback;
    }
  }

  async generateConversationReply(input: ConversationInput): Promise<AiReply> {
    const fallback = fallbackConversation(input.mode);
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
      fallback,
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
      fallback: {
        reply: "Good. Explain the bug in one simple sentence.",
        suggestedPhrase: "The issue happens when the user opens the page.",
        nextQuestion: "What is the impact?",
        level: "A1",
      },
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
      fallback: {
        reply: "Describe it in English first. What do you use it for?",
        correction: "",
        suggestedPhrase: "I use it to sit down.",
        nextQuestion: "Where do you use it?",
        level: "A1",
      },
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
      fallback: {
        topic: input.topic ?? "work",
        level: input.level ?? "A1",
        examples: dashboardMock.vocabulary.slice(0, 3).map((item) => ({
          phrase: item.phrase,
          translation: item.translation,
          category: item.category,
        })),
      },
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
      fallback: {
        focus: "Speak with confidence using simple English.",
        blocks: dashboardMock.dailyPlan.blocks.map((block) => ({
          title: block.title,
          durationMinutes: block.durationMinutes,
          objective: block.objective,
        })),
      },
    });
  }

  async analyzeStudentMistake(input: MistakeInput) {
    const result = await this.createJsonResponse({
      mode: "mistake",
      instructions: `
Analise apenas erros importantes para comunicacao.
Retorne:
{"originalSentence":"frase original","correctedSentence":"frase corrigida","mistakeType":"tipo do erro","explanation":"explicacao curta em portugues"}
`,
      userContent: JSON.stringify(input),
      fallback: {
        originalSentence: input.sentence,
        correctedSentence: input.sentence,
        mistakeType: "fluency",
        explanation: "Continue praticando frases curtas e naturais.",
      },
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
