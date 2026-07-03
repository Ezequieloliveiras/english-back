"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiService = exports.AiProviderError = void 0;
const openai_1 = __importDefault(require("openai"));
const env_1 = require("../config/env");
class AiProviderError extends Error {
    constructor(message, statusCode = 503) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.AiProviderError = AiProviderError;
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
const parseJson = (text) => {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    return JSON.parse(cleaned);
};
const limitMessages = (messages = []) => messages.slice(-8);
class OpenAiService {
    constructor(aiRepository) {
        this.aiRepository = aiRepository;
        this.client = env_1.env.openAiApiKey
            ? new openai_1.default({ apiKey: env_1.env.openAiApiKey, maxRetries: 0, timeout: 20000 })
            : null;
    }
    async createJsonResponse({ mode, instructions, userContent, }) {
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
            return parseJson(response.output_text);
        }
        catch (error) {
            console.error(`[ai:${mode}] OpenAI request failed`, error instanceof Error ? error.message : error);
            const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
            if (status === 401) {
                throw new AiProviderError("OpenAI API key is invalid. Update OPENAI_API_KEY and restart the backend.", 401);
            }
            if (status === 429) {
                throw new AiProviderError("OpenAI quota or billing limit was reached. Add API billing/credits to continue real AI conversations.", 429);
            }
            if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
                throw new AiProviderError("OpenAI took too long to respond. Please try again.", 504);
            }
            throw new AiProviderError("OpenAI is unavailable right now. Please try again.", 503);
        }
    }
    async generateConversationReply(input) {
        const reply = await this.createJsonResponse({
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
    async generateDeveloperEnglishReply(input) {
        const reply = await this.createJsonResponse({
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
    async generateThinkInEnglishReply(input) {
        const reply = await this.createJsonResponse({
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
    async generateVocabularyExamples(input) {
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
    async generateDailyPlan(input) {
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
    async analyzeStudentMistake(input) {
        const result = await this.createJsonResponse({
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
    async persistConversation(input, reply) {
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
exports.OpenAiService = OpenAiService;
