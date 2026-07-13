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
exports.OpenAiService = exports.AiProviderError = void 0;
const openai_1 = __importStar(require("openai"));
const env_1 = require("../config/env");
const speakingCoachAnalysis_service_1 = require("./speakingCoachAnalysis.service");
class AiProviderError extends Error {
    constructor(message, statusCode = 503, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}
exports.AiProviderError = AiProviderError;
const basePrompt = `
Você é um professor de inglês sênior com mais de 20 anos de experiência.
Seu aluno é iniciante e precisa aprender inglês rapidamente para se comunicar.
Priorize fala, listening, frases úteis e confiança.
Corrija somente erros importantes.
Não interrompa a fluência por pequenos erros.
Use inglês simples, nível A1/A2, nas frases de treino e nas respostas que o aluno deve praticar.
Quando o usuário estiver com suporte em português, explique instruções, feedback e raciocínio pedagógico em português brasileiro.
Nunca dê aulas longas de gramática.
Faça perguntas curtas para manter a conversa.
Use frases naturais do dia a dia.
Quando o modo for desenvolvedor, use contexto de programação, APIs, bugs, deploy, banco de dados, frontend, backend e reuniões técnicas.
Retorne sempre JSON válido, sem markdown.
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
Use frases curtas e naturais para contexto técnico.
`;
const parseJson = (text) => {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    return JSON.parse(cleaned);
};
const limitMessages = (messages = []) => messages.slice(-8);
const normalizeWords = (text) => text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
const countWords = (text) => normalizeWords(text).length;
const metricsToMap = (metrics) => metrics.reduce((acc, metric) => {
    acc[metric.label] = metric.value;
    return acc;
}, {});
const languageInstruction = (settings) => settings.languageMode === "full_english"
    ? "The user selected full English. Return all explanations, corrections, suggestions, titles and labels in English only."
    : "The user selected Portuguese support. Explain pedagogy in Brazilian Portuguese when helpful, but keep English corrections, example phrases and natural suggestions in English.";
const englishPedagogyPattern = /\b(you said|you pronounced|you missed|you used|you added|your pronunciation|your rhythm|your recording|good rhythm|clear pronunciation|connected speech|add the|missing word|instead of|people often|it sounds|sounds more|improve intonation|practice saying|try saying)\b/i;
const hasEnglishPedagogyWhenPortugueseNeeded = (settings, feedback) => {
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
    ].filter((text) => typeof text === "string");
    return texts.some((text) => englishPedagogyPattern.test(text.replace(/"[^"]+"/g, "")));
};
class OpenAiService {
    constructor(aiRepository, settingsRepository) {
        this.aiRepository = aiRepository;
        this.settingsRepository = settingsRepository;
        this.client = env_1.env.openAiApiKey
            ? new openai_1.default({ apiKey: env_1.env.openAiApiKey, maxRetries: 0, timeout: 20000 })
            : null;
    }
    async createJsonResponse({ mode, instructions, userContent, }) {
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
            return parseJson(response.output_text);
        }
        catch (error) {
            console.error(`[ai:${mode}] OpenAI request failed`, error instanceof Error ? error.message : error);
            if (error instanceof SyntaxError) {
                throw new AiProviderError("OpenAI returned an invalid structured response.", 502);
            }
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
    async ensureSpeakingCoachFeedbackLanguage({ settings, feedback, }) {
        if (!hasEnglishPedagogyWhenPortugueseNeeded(settings, feedback)) {
            return feedback;
        }
        const repairedFeedback = await this.createJsonResponse({
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
    async generateConversationReply(input) {
        const settings = await this.getUserSettings(input.userId);
        const reply = await this.createJsonResponse({
            mode: "conversation",
            instructions: `
${languageInstruction(settings)}
Return this JSON shape:
{"reply":"short answer","correction":"short correction if needed","suggestedPhrase":"better phrase","nextQuestion":"short next question","level":"A1"}
Modo escolhido: ${input.mode}
Nível: ${input.level ?? "A1"}
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
        const settings = await this.getUserSettings(input.userId);
        const reply = await this.createJsonResponse({
            mode: "dev-mode",
            instructions: `
${developerContexts}
${languageInstruction(settings)}
Return this JSON shape:
{"reply":"short answer","correction":"short correction if needed","suggestedPhrase":"better technical phrase","nextQuestion":"short technical next question","level":"A1"}
Modo técnico: ${input.mode}
Nível: ${input.level ?? "A1"}
Objetivo: ${input.goal ?? "inglês técnico para trabalho"}
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
        const settings = await this.getUserSettings(input.userId);
        const reply = await this.createJsonResponse({
            mode: "think-in-english",
            instructions: `
${languageInstruction(settings)}
Se o usuário pedir tradução palavra por palavra, incentive a descrição em inglês primeiro.
Return this JSON shape:
{"reply":"short answer in simple English","correction":"","suggestedPhrase":"useful phrase","nextQuestion":"short question","level":"A1"}
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
        const settings = await this.getUserSettings(input.userId);
        return this.createJsonResponse({
            mode: "vocabulary",
            instructions: `
${languageInstruction(settings)}
Crie vocabulário sempre com frases completas, nunca palavras isoladas.
Return this JSON shape:
{"topic":"topic","level":"A1","examples":[{"phrase":"English phrase","translation":"short translation when Portuguese support is enabled, otherwise English meaning","category":"category"}]}
`,
            userContent: JSON.stringify(input),
        });
    }
    async generateDailyPlan(input) {
        return this.createJsonResponse({
            mode: "daily-plan",
            instructions: `
Monte uma rotina curta de inglês para hoje.
Retorne:
{"focus":"foco do dia","blocks":[{"title":"Shadowing","durationMinutes":8,"objective":"objetivo curto"}]}
Use os minutos disponíveis sem ultrapassar o total.
`,
            userContent: JSON.stringify(input),
        });
    }
    async analyzeSpeakingCoachAttempt(input) {
        const settings = await this.getUserSettings(input.userId);
        if (!this.client) {
            throw new AiProviderError("OpenAI is not configured on the backend.", 503);
        }
        try {
            const { wavBuffer, audioQuality } = await (0, speakingCoachAnalysis_service_1.normalizeAndAnalyzeAudio)({
                buffer: input.audioBuffer,
                mimeType: input.audioMimeType,
            });
            const audioFile = await (0, openai_1.toFile)(wavBuffer, `speaking-coach.${(0, speakingCoachAnalysis_service_1.speakingAudioExtension)("audio/wav")}`, {
                type: "audio/wav",
            });
            const transcription = await this.client.audio.transcriptions.create({
                file: audioFile,
                model: "gpt-4o-mini-transcribe",
                language: "en",
            });
            const transcript = transcription.text ?? "";
            const comparison = (0, speakingCoachAnalysis_service_1.comparePhraseToTranscript)(input.targetPhrase, transcript);
            (0, speakingCoachAnalysis_service_1.validateTranscriptComparison)(transcript, audioQuality, comparison);
            const pipeline = (0, speakingCoachAnalysis_service_1.buildSpeakingCoachPipeline)(audioQuality, comparison);
            const derived = (0, speakingCoachAnalysis_service_1.deriveSpeakingMetrics)(audioQuality, comparison, pipeline);
            console.info("[ai:speaking-coach] validated", {
                durationSeconds: audioQuality.durationSeconds,
                speechRatio: audioQuality.speechRatio,
                speechSegments: audioQuality.speechSegments.length,
                words: comparison.spokenWords.length,
                coverage: comparison.coverage,
                rhythmScore: pipeline.rhythmAnalysis.score,
                phonemeScore: pipeline.phonemeAnalysis.score,
                status: "ok",
            });
            const feedbackResult = await this.createJsonResponse({
                mode: "speaking-coach",
                instructions: `
You are a private English pronunciation teacher for Brazilian learners.
Use ONLY the real evidence provided. Do not invent acoustic data.
The scores were already calculated deterministically. Do not return scores.
Teach like an experienced coach: explain what happened, why it happens, when to use it and when to avoid it.
Focus on what is supported by the transcript, target coverage, missing/extra words, duration, volume and speech ratio.
Also use forcedAlignment, phonemeAnalysis and rhythmAnalysis when provided. These are deterministic local analysis results.
If phonemeAnalysis has issues, explain the specific word/sound only when it is present in the evidence.
If rhythmAnalysis shows low WPM, long pauses or low speech ratio, explain rhythm/fluency from those values.
Do not claim tongue position, mouth shape or native-level acoustic facts unless the evidence explicitly supports it.
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
When forcedAlignment has a substitution, make the first feedback item direct and comparative:
- In Brazilian Portuguese mode, start whatHappened with: Você pronunciou "spokenWord", mas se diz "expectedWord"...
- Then explain the stress, sound, rhythm or syllable emphasis using the available evidence.
- Example style: Você pronunciou "douctor", mas se diz "doctor", enfatizando a primeira sílaba: "DOC-tor".
- Keep spokenWord and expectedWord inside quotes exactly as English words.
When the issue is a missing word, use: Você deixou de falar "expectedWord"...; when it is an extra word, use: Você adicionou "spokenWord"...
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
                    forcedAlignment: pipeline.alignment,
                    priorityCorrection: pipeline.alignment.find((item) => item.status === "substitution") ??
                        pipeline.alignment.find((item) => item.status === "missing") ??
                        pipeline.alignment.find((item) => item.status === "extra"),
                    phonemeAnalysis: pipeline.phonemeAnalysis,
                    rhythmAnalysis: pipeline.rhythmAnalysis,
                    analysisEngine: pipeline.analysisEngine,
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
            const result = {
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
                alignment: pipeline.alignment,
                phonemeAnalysis: pipeline.phonemeAnalysis,
                rhythmAnalysis: pipeline.rhythmAnalysis,
                analysisEngine: pipeline.analysisEngine,
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
                analysisModel: "gpt-4o-mini-transcribe+local-alignment-phoneme-rhythm",
                analysisDetails: {
                    alignment: pipeline.alignment,
                    phonemeAnalysis: pipeline.phonemeAnalysis,
                    rhythmAnalysis: pipeline.rhythmAnalysis,
                    analysisEngine: pipeline.analysisEngine,
                },
                audioMimeType: input.audioMimeType,
                status: "ok",
            });
            return {
                ...localizedResult,
                mode: "ai",
            };
        }
        catch (error) {
            console.error("[ai:speaking-coach] analysis failed", error instanceof Error ? error.message : error);
            if (error instanceof speakingCoachAnalysis_service_1.SpeakingCoachValidationError) {
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
    async getUserSettings(userId) {
        if (!this.settingsRepository) {
            return {
                userId,
                languageMode: "pt_explanation_en_correction",
                supportLanguageMode: "moderate_support",
                preferredAccent: "american",
                preferredVoice: "alloy",
                correctionStyle: "gentle",
                interfaceLanguage: "pt-BR",
                primaryObjective: "conversation",
                dailyMinutes: 20,
            };
        }
        return this.settingsRepository.findOrCreate(userId);
    }
    async analyzeStudentMistake(input) {
        const settings = await this.getUserSettings(input.userId);
        const result = await this.createJsonResponse({
            mode: "mistake",
            instructions: `
${languageInstruction(settings)}
Analise apenas erros importantes para comunicacao.
Return this JSON shape:
{"originalSentence":"original sentence","correctedSentence":"corrected sentence","mistakeType":"mistake type","explanation":"short explanation in the user's selected language"}
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
