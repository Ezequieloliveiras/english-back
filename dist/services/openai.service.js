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
const learningPreferences_service_1 = require("./learningPreferences.service");
const promptContext_service_1 = require("./promptContext.service");
const translationValidator_1 = require("../utils/translationValidator");
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
VocÃª Ã© um professor de inglÃªs sÃªnior com mais de 20 anos de experiÃªncia.
Seu aluno Ã© iniciante e precisa aprender inglÃªs rapidamente para se comunicar.
Priorize fala, listening, frases Ãºteis e confianÃ§a.
Corrija somente erros importantes.
NÃ£o interrompa a fluÃªncia por pequenos erros.
Use inglÃªs simples, nÃ­vel A1/A2, nas frases de treino e nas respostas que o aluno deve praticar.
Quando o usuÃ¡rio estiver com suporte em portuguÃªs, explique instruÃ§Ãµes, feedback e raciocÃ­nio pedagÃ³gico em portuguÃªs brasileiro.
Quando interfaceLanguage for "pt-BR", qualquer campo chamado translation, translationPt ou translationPtBr deve ser uma traducao real, completa e natural em portugues brasileiro.
Nunca preencha traducao com a frase original em ingles precedida por texto em portugues, como "Eu consigo dizer:" ou "E assim que se diz".
Quando interfaceLanguage for "pt-BR", explicacoes, feedback e dicas gramaticais devem ficar em portugues brasileiro; use ingles apenas em frases de treino, correcoes ou exemplos citados.
Nunca dÃª aulas longas de gramÃ¡tica.
FaÃ§a perguntas curtas para manter a conversa.
Use frases naturais do dia a dia.
Quando o modo for desenvolvedor, use contexto de programaÃ§Ã£o, APIs, bugs, deploy, banco de dados, frontend, backend e reuniÃµes tÃ©cnicas.
Retorne sempre JSON vÃ¡lido, sem markdown.
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
Use frases curtas e naturais para contexto tÃ©cnico.
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
const calculateCorrectionCount = (input) => {
    const structuralDifferences = input.missingWords.length + input.extraWords.length;
    const similarityPenalty = input.similarity < 0.92 ? 1 : 0;
    return Math.max(input.correctedWords.length, structuralDifferences, similarityPenalty);
};
const buildMetricMetadata = (comparison) => {
    const confidence = Number(Math.max(0.25, Math.min(0.85, comparison.coverage * 0.45 + comparison.similarity * 0.4)).toFixed(2));
    return {
        isEstimated: true,
        analysisMethod: "heuristic_audio_text",
        confidence,
    };
};
const decorateEstimatedMetrics = (metrics, comparison) => {
    const metadata = buildMetricMetadata(comparison);
    return metrics.map((metric) => ({
        ...metric,
        ...metadata,
    }));
};
const metricsToMap = (metrics) => metrics.reduce((acc, metric) => {
    acc[metric.label] = metric.value;
    return acc;
}, {});
const findLowestSpeakingMetric = (metrics) => {
    const candidates = [
        ["Pronunciation", metrics["Pronunciation Score"]],
        ["Naturalness", metrics.Naturalness],
        ["Connected Speech", metrics["Connected Speech"]],
        ["Stress", metrics.Stress],
        ["Intonation", metrics.Intonation],
        ["Rhythm", metrics.Rhythm],
        ["Fluency", metrics.Fluency],
    ].filter((entry) => typeof entry[1] === "number");
    return candidates.sort((a, b) => a[1] - b[1])[0]?.[0] ?? "Not enough data yet";
};
const languageInstruction = (preferences) => promptContext_service_1.PromptContextBuilder.build(preferences);
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
    constructor(aiRepository, learningPreferencesService, progressService) {
        this.aiRepository = aiRepository;
        this.learningPreferencesService = learningPreferencesService;
        this.progressService = progressService;
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
        const storedHistory = await this.aiRepository.getRecentConversationMessages({
            userId: input.userId,
            mode: input.mode,
            sessionId: input.conversationSessionId,
            limit: 8,
            maxCharacters: 4000,
        });
        const reply = await this.createJsonResponse({
            mode: "conversation",
            instructions: `
${languageInstruction(settings)}
Return this JSON shape:
{"reply":"short answer","correction":"short correction if needed","suggestedPhrase":"better phrase","nextQuestion":"short next question","level":"A1"}
Modo escolhido: ${input.mode}
NÃ­vel: ${input.level ?? "A1"}
Objetivo: ${input.goal ?? "comunicacao real"}
`,
            userContent: JSON.stringify({
                recentHistory: storedHistory.length ? storedHistory : limitMessages(input.previousMessages),
                userMessage: input.message,
            }),
        });
        const session = await this.persistConversation(input, reply);
        return { ...reply, sessionId: session.sessionId };
    }
    async generateDeveloperEnglishReply(input) {
        const settings = await this.getUserSettings(input.userId);
        const mode = `developer:${input.mode}`;
        const storedHistory = await this.aiRepository.getRecentConversationMessages({
            userId: input.userId,
            mode,
            sessionId: input.conversationSessionId,
            limit: 8,
            maxCharacters: 4000,
        });
        const reply = await this.createJsonResponse({
            mode: "dev-mode",
            instructions: `
${developerContexts}
${languageInstruction(settings)}
Return this JSON shape:
{"reply":"short answer","correction":"short correction if needed","suggestedPhrase":"better technical phrase","nextQuestion":"short technical next question","level":"A1"}
Modo tÃ©cnico: ${input.mode}
NÃ­vel: ${input.level ?? "A1"}
Objetivo: ${input.goal ?? "inglÃªs tÃ©cnico para trabalho"}
`,
            userContent: JSON.stringify({
                recentHistory: storedHistory.length ? storedHistory : limitMessages(input.previousMessages),
                userMessage: input.message,
            }),
        });
        const session = await this.persistConversation({ ...input, mode }, reply);
        return { ...reply, sessionId: session.sessionId };
    }
    async generateThinkInEnglishReply(input) {
        const settings = await this.getUserSettings(input.userId);
        const storedHistory = await this.aiRepository.getRecentConversationMessages({
            userId: input.userId,
            mode: "think-in-english",
            sessionId: input.conversationSessionId,
            limit: 8,
            maxCharacters: 4000,
        });
        const reply = await this.createJsonResponse({
            mode: "think-in-english",
            instructions: `
${languageInstruction(settings)}
Se o usuÃ¡rio pedir traduÃ§Ã£o palavra por palavra, incentive a descriÃ§Ã£o em inglÃªs primeiro.
Return this JSON shape:
{"reply":"short answer in simple English","correction":"","suggestedPhrase":"useful phrase","nextQuestion":"short question","level":"A1"}
`,
            userContent: JSON.stringify({
                recentHistory: storedHistory.length ? storedHistory : limitMessages(input.previousMessages),
                userMessage: input.message,
            }),
        });
        const session = await this.persistConversation({ ...input, mode: "think-in-english" }, reply);
        return { ...reply, sessionId: session.sessionId };
    }
    async generateVocabularyExamples(input) {
        const settings = await this.getUserSettings(input.userId);
        const result = await this.createJsonResponse({
            mode: "vocabulary",
            instructions: `
${languageInstruction(settings)}
Crie vocabulÃ¡rio sempre com frases completas, nunca palavras isoladas.
Se interfaceLanguage for "pt-BR", cada translation deve ser 100% portugues brasileiro, sem repetir a phrase em ingles e sem misturar idiomas.
Para vocabulario de uma palavra, translation deve ser somente o significado em portugues, por exemplo "Medico.", "Problema.", "Sugerir.".
Return this JSON shape:
{"topic":"topic","level":"A1","examples":[{"phrase":"English phrase","translation":"complete Brazilian Portuguese translation when Portuguese support is enabled, otherwise English meaning","category":"category"}]}
`,
            userContent: JSON.stringify(input),
        });
        if (settings.portugueseSupportLevel === "none") {
            return result;
        }
        return {
            ...result,
            examples: (result.examples ?? []).map((example) => {
                const validation = (0, translationValidator_1.validatePortugueseTranslation)(example.phrase, example.translation);
                return validation.valid
                    ? example
                    : {
                        ...example,
                        translation: "Tradução em português indisponível.",
                    };
            }),
        };
    }
    async generateDailyPlan(input) {
        return this.createJsonResponse({
            mode: "daily-plan",
            instructions: `
Monte uma rotina curta de inglÃªs para hoje.
Retorne:
{"focus":"foco do dia","blocks":[{"title":"Shadowing","durationMinutes":8,"objective":"objetivo curto"}]}
Use os minutos disponÃ­veis sem ultrapassar o total.
`,
            userContent: JSON.stringify(input),
        });
    }
    async analyzeSpeakingCoachAttempt(input) {
        const settings = await this.getUserSettings(input.userId);
        const startedAt = Date.now();
        const requestId = input.requestId ?? `speaking-${Date.now().toString(36)}`;
        let stage = "start";
        if (!this.client) {
            throw new AiProviderError("OpenAI is not configured on the backend.", 503);
        }
        try {
            console.info("[ai:speaking-coach] start", {
                requestId,
                stage,
                fileSizeBytes: input.audioBuffer.length,
                mimeType: input.audioMimeType,
            });
            stage = "normalize_audio";
            const { wavBuffer, audioQuality } = await (0, speakingCoachAnalysis_service_1.normalizeAndAnalyzeAudio)({
                buffer: input.audioBuffer,
                mimeType: input.audioMimeType,
            });
            const audioFile = await (0, openai_1.toFile)(wavBuffer, `speaking-coach.${(0, speakingCoachAnalysis_service_1.speakingAudioExtension)("audio/wav")}`, {
                type: "audio/wav",
            });
            stage = "transcribe";
            const transcription = await this.client.audio.transcriptions.create({
                file: audioFile,
                model: "gpt-4o-mini-transcribe",
                language: settings.transcriptionLanguage,
            });
            const transcript = transcription.text ?? "";
            const rawTranscript = transcript;
            stage = "compare_transcript";
            const comparison = (0, speakingCoachAnalysis_service_1.comparePhraseToTranscript)(input.targetPhrase, transcript);
            (0, speakingCoachAnalysis_service_1.validateTranscriptComparison)(transcript, audioQuality, comparison);
            stage = "local_analysis";
            const pipeline = (0, speakingCoachAnalysis_service_1.buildSpeakingCoachPipeline)(audioQuality, comparison);
            const derived = (0, speakingCoachAnalysis_service_1.deriveSpeakingMetrics)(audioQuality, comparison, pipeline);
            console.info("[ai:speaking-coach] validated", {
                requestId,
                stage,
                fileSizeBytes: input.audioBuffer.length,
                mimeType: input.audioMimeType,
                durationSeconds: audioQuality.durationSeconds,
                speechRatio: audioQuality.speechRatio,
                speechSegments: audioQuality.speechSegments.length,
                words: comparison.spokenWords.length,
                coverage: comparison.coverage,
                rhythmScore: pipeline.rhythmAnalysis.score,
                phonemeScore: pipeline.phonemeAnalysis.score,
                status: "ok",
            });
            stage = "feedback_generation";
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
- preferredAccent: ${settings.accent}
- correctionStyle: ${settings.correctionStyle}
- primaryObjective: ${settings.primaryObjective}
If languageMode is "pt_explanation_en_correction": write pedagogical explanations in clear Brazilian Portuguese, but keep corrections, spoken phrases and examples in English.
If languageMode is "full_english": write everything in simple A1/A2 English, including titles, subtitles, explanations, strengths, improvements, nextMission and patterns.
When forcedAlignment has a substitution, make the first feedback item direct and comparative:
- In Brazilian Portuguese mode, start whatHappened with: VocÃª pronunciou "spokenWord", mas se diz "expectedWord"...
- Then explain the stress, sound, rhythm or syllable emphasis using the available evidence.
- Example style: VocÃª pronunciou "douctor", mas se diz "doctor", enfatizando a primeira sÃ­laba: "DOC-tor".
- Keep spokenWord and expectedWord inside quotes exactly as English words.
When the issue is a missing word, use: VocÃª deixou de falar "expectedWord"...; when it is an extra word, use: VocÃª adicionou "spokenWord"...
For Brazilian Portuguese mode, these pedagogical fields must be in Brazilian Portuguese:
title, whatHappened, whyItHappens, whenToUse, whenToAvoid, drill, strengths, improvements, nextMission, patterns.evidence and patterns.exercise.
Keep only literal quoted English phrases in English, such as "want to", "wanna" and "I wanna talk about my routine.".
In Brazilian Portuguese mode, do not write phrases like "You said", "Good rhythm", "Practice..." outside quoted examples; write them in Portuguese, like "VocÃª disse...", "Bom ritmo...", "Pratique...".
In Brazilian Portuguese mode, do not write explanations such as "E assim que se diz doctor" as if they were translations. If teaching vocabulary, explain in Portuguese, for example: Em ingles, "doctor" significa "medico".
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
                    transcriptFromAudio: rawTranscript,
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
            stage = "feedback_language_check";
            const localizedFeedbackResult = await this.ensureSpeakingCoachFeedbackLanguage({
                settings,
                feedback: feedbackResult,
            });
            const speechAnalysis = (0, speakingCoachAnalysis_service_1.buildSpeechAnalysisResult)({
                rawTranscript,
                expectedText: input.targetPhrase,
                targetLanguage: settings.targetLanguage,
                transcriptionLanguage: settings.transcriptionLanguage,
                detectedLanguage: settings.transcriptionLanguage,
                translated: false,
                comparison,
                alignment: pipeline.alignment,
                feedbackPtBr: settings.interfaceLanguage === "pt-BR" ? localizedFeedbackResult.feedback?.[0]?.whatHappened : undefined,
            });
            const result = {
                ...speechAnalysis,
                status: "ok",
                detectedSpeech: true,
                transcript: rawTranscript,
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
                metrics: decorateEstimatedMetrics(derived.metrics, comparison),
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
            const correctionCount = calculateCorrectionCount({
                missingWords: comparison.missingWords,
                extraWords: comparison.extraWords,
                similarity: comparison.similarity,
                correctedWords,
            });
            const metadata = buildMetricMetadata(comparison);
            stage = "save_attempt";
            const savedAttempt = await this.aiRepository.saveSpeakingAttempt({
                userId: input.userId,
                expectedText: input.targetPhrase,
                transcribedText: rawTranscript,
                rawTranscript: speechAnalysis.rawTranscript,
                normalizedTranscript: speechAnalysis.normalizedTranscript,
                correctedText: speechAnalysis.correctedText,
                translated: speechAnalysis.translated,
                detectedLanguage: speechAnalysis.detectedLanguage,
                targetLanguage: speechAnalysis.targetLanguage,
                transcriptionLanguage: speechAnalysis.transcriptionLanguage,
                feedbackPtBr: speechAnalysis.feedbackPtBr,
                wordAnalysis: speechAnalysis.wordAnalysis,
                preferencesVersion: settings.version,
                pronunciationScore: metrics["Pronunciation Score"] ?? localizedResult.overallScore,
                naturalnessScore: metrics.Naturalness ?? localizedResult.overallScore,
                connectedSpeechScore: metrics["Connected Speech"] ?? localizedResult.overallScore,
                stressScore: metrics.Stress ?? localizedResult.overallScore,
                intonationScore: metrics.Intonation ?? localizedResult.overallScore,
                rhythmScore: metrics.Rhythm ?? localizedResult.overallScore,
                fluencyScore: metrics.Fluency ?? localizedResult.overallScore,
                wordsSpokenCount: countWords(rawTranscript),
                correctedWords,
                correctionCount,
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
                metricMetadata: metadata,
                audioMimeType: input.audioMimeType,
                status: "ok",
            });
            await this.progressService?.recordSpeakingAttempt({
                userId: input.userId,
                attemptId: String(savedAttempt._id ?? requestId),
                expectedText: input.targetPhrase,
                transcribedText: rawTranscript,
                rawTranscript: speechAnalysis.rawTranscript,
                normalizedTranscript: speechAnalysis.normalizedTranscript,
                correctedText: speechAnalysis.correctedText,
                translated: speechAnalysis.translated,
                detectedLanguage: speechAnalysis.detectedLanguage,
                targetLanguage: speechAnalysis.targetLanguage,
                transcriptionLanguage: speechAnalysis.transcriptionLanguage,
                feedbackPtBr: speechAnalysis.feedbackPtBr,
                wordAnalysis: speechAnalysis.wordAnalysis,
                preferencesVersion: settings.version,
                wordsSpokenCount: countWords(rawTranscript),
                correctedWords,
                correctionCount,
                durationSeconds: audioQuality.durationSeconds,
                mainImprovementArea: findLowestSpeakingMetric(metrics),
                pronunciationScore: metrics["Pronunciation Score"] ?? localizedResult.overallScore,
                level: input.level?.toUpperCase() ?? "A1",
            });
            console.info("[ai:speaking-coach] completed", {
                requestId,
                stage: "completed",
                fileSizeBytes: input.audioBuffer.length,
                mimeType: input.audioMimeType,
                durationSeconds: audioQuality.durationSeconds,
                providerStatus: "ok",
                processingMs: Date.now() - startedAt,
            });
            return {
                ...localizedResult,
                metricMetadata: metadata,
                pronunciationEstimate: metrics["Pronunciation Score"] ?? localizedResult.overallScore,
                rhythmEstimate: metrics.Rhythm ?? localizedResult.overallScore,
                intonationEstimate: metrics.Intonation ?? localizedResult.overallScore,
                mode: "ai",
            };
        }
        catch (error) {
            const providerStatus = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
            console.error("[ai:speaking-coach] analysis failed", {
                requestId,
                stage,
                fileSizeBytes: input.audioBuffer.length,
                mimeType: input.audioMimeType,
                providerStatus,
                processingMs: Date.now() - startedAt,
                message: error instanceof Error ? error.message : String(error),
            });
            if (error instanceof speakingCoachAnalysis_service_1.SpeakingCoachValidationError) {
                throw new AiProviderError(error.message, error.statusCode, error.status);
            }
            const status = providerStatus;
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
        if (!this.learningPreferencesService) {
            return (0, learningPreferences_service_1.defaultEffectiveLearningPreferences)(userId);
        }
        return this.learningPreferencesService.getEffectivePreferences(userId);
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
        const session = await this.aiRepository.saveConversationTurn({
            userId: input.userId,
            mode: input.mode,
            sessionId: input.conversationSessionId,
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
        return session;
    }
}
exports.OpenAiService = OpenAiService;
