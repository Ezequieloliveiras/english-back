"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const seedData_1 = require("../data/seedData");
const contentCatalog_model_1 = require("../models/contentCatalog.model");
const reviewSchedule_model_1 = require("../models/reviewSchedule.model");
const vocabularyItem_model_1 = require("../models/vocabularyItem.model");
const planBlockOrder = [
    "shadowing",
    "speaking-coach",
    "listening",
    "vocabulary",
    "conversation",
    "review",
];
const rotateItems = (items, rotation) => {
    if (!items.length) {
        return items;
    }
    const index = Math.abs(rotation) % items.length;
    return [...items.slice(index), ...items.slice(0, index)];
};
const uniqueBy = (items, getKey) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = getKey(item).toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};
const getPlanRotation = (dailyPlan) => {
    const firstType = dailyPlan.blocks[0]?.type;
    const index = firstType ? planBlockOrder.indexOf(firstType) : 0;
    return index >= 0 ? index : 0;
};
const safeText = (value, fallback) => value.trim().replace(/\s+/g, " ") || fallback;
const buildPlanScenario = (user, dailyPlan) => {
    const rotation = getPlanRotation(dailyPlan);
    const profession = safeText(user.profession, "your work");
    const goal = safeText(user.primaryGoal, "speak with more confidence");
    const scenarios = [
        {
            title: "Planning the Next Task",
            situation: `A short work conversation about priorities in ${profession}.`,
            dialogue: [
                "Manager: What is your main focus for this session?",
                `Student: I want to practice English for ${goal}.`,
                "Manager: Good. What is one small task you can finish now?",
                "Student: I can explain my next step in simple English.",
            ],
            translations: [
                "Qual e o seu foco principal nesta sessao?",
                `Eu quero praticar ingles para ${goal}.`,
                "Certo. Qual e uma pequena tarefa que voce consegue terminar agora?",
                "Eu consigo explicar meu proximo passo em ingles simples.",
            ],
            questions: [
                { prompt: "What does the student want to practice?", answer: goal },
                { prompt: "What can the student explain?", answer: "The next step in simple English." },
            ],
        },
        {
            title: "Explaining a Blocker",
            situation: "A teammate asks for a clear update about a blocker.",
            dialogue: [
                "Teammate: Are you blocked on anything right now?",
                "Student: Yes, I need more context before I continue.",
                "Teammate: What context do you need?",
                `Student: I need the goal and the expected result for this ${profession} task.`,
            ],
            translations: [
                "Voce esta bloqueado em alguma coisa agora?",
                "Sim, eu preciso de mais contexto antes de continuar.",
                "De que contexto voce precisa?",
                `Eu preciso do objetivo e do resultado esperado para esta tarefa de ${profession}.`,
            ],
            questions: [
                { prompt: "What does the student need?", answer: "More context." },
                { prompt: "What result does the student need?", answer: "The expected result." },
            ],
        },
        {
            title: "Reviewing Progress",
            situation: "A quick review of what was practiced and what comes next.",
            dialogue: [
                "Coach: What did you practice in this cycle?",
                "Student: I practiced short answers and useful work phrases.",
                "Coach: What should you do next?",
                "Student: I should repeat the strongest phrases out loud.",
            ],
            translations: [
                "O que voce praticou neste ciclo?",
                "Eu pratiquei respostas curtas e frases uteis de trabalho.",
                "O que voce deve fazer agora?",
                "Eu devo repetir as frases mais fortes em voz alta.",
            ],
            questions: [
                { prompt: "What did the student practice?", answer: "Short answers and useful work phrases." },
                { prompt: "What should the student repeat?", answer: "The strongest phrases." },
            ],
        },
        {
            title: "Asking for Clarification",
            situation: "A practical exchange for understanding instructions.",
            dialogue: [
                "Lead: Can you handle this today?",
                "Student: I can, but I need to confirm one detail first.",
                "Lead: Sure. What do you want to confirm?",
                "Student: I want to confirm the priority and the deadline.",
            ],
            translations: [
                "Voce consegue cuidar disso hoje?",
                "Eu consigo, mas preciso confirmar um detalhe primeiro.",
                "Claro. O que voce quer confirmar?",
                "Eu quero confirmar a prioridade e o prazo.",
            ],
            questions: [
                { prompt: "Can the student handle the task?", answer: "Yes, after confirming one detail." },
                { prompt: "What does the student confirm?", answer: "The priority and the deadline." },
            ],
        },
    ];
    return scenarios[rotation % scenarios.length];
};
const chunkByPhrase = (text, translation) => {
    const words = text.replace(/[?.!]/g, "").split(/\s+/).filter(Boolean);
    if (words.length <= 4) {
        return [{ text, meaning: translation }];
    }
    const middle = Math.ceil(words.length / 2);
    return [
        { text: words.slice(0, middle).join(" "), meaning: translation },
        { text: words.slice(middle).join(" "), meaning: "parte final da ideia" },
    ];
};
const buildPlanListeningLesson = (user, dailyPlan) => {
    const rotation = getPlanRotation(dailyPlan);
    const scenario = buildPlanScenario(user, dailyPlan);
    return {
        id: `plan-listening-${dailyPlan.date}-${rotation}`,
        title: scenario.title,
        level: user.currentLevel,
        situationDescription: scenario.situation,
        dialogue: scenario.dialogue,
        questions: scenario.questions.map((question, index) => ({
            id: `plan-question-${dailyPlan.date}-${rotation}-${index + 1}`,
            ...question,
        })),
        comprehension: scenario.dialogue.map((line, index) => {
            const text = line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line;
            const translation = scenario.translations[index] ?? "Traducao em portugues indisponivel.";
            return {
                sourceText: text,
                naturalTranslation: translation,
                translationPtBr: translation,
                context: "Use esta frase como parte do ciclo atual de estudo.",
                chunks: chunkByPhrase(text, translation),
                pronunciationTip: "Mantenha a frase curta, clara e conectada.",
            };
        }),
    };
};
const buildPlanShadowingItems = (user, dailyPlan) => {
    const rotation = getPlanRotation(dailyPlan);
    const goal = safeText(user.primaryGoal, "speak with more confidence");
    const profession = safeText(user.profession, "work");
    const sets = [
        [
            {
                id: `plan-shadowing-${dailyPlan.date}-${rotation}-1`,
                phrase: "I can explain the next step in simple English.",
                naturalTranslation: "Eu consigo explicar o proximo passo em ingles simples.",
                pronunciationHint: "Stress 'next step' and keep the ending clear.",
                context: `Use this for ${profession} updates.`,
                chunks: [
                    { text: "I can explain", meaning: "Eu consigo explicar" },
                    { text: "the next step", meaning: "o proximo passo" },
                    { text: "in simple English", meaning: "em ingles simples" },
                ],
            },
            {
                id: `plan-shadowing-${dailyPlan.date}-${rotation}-2`,
                phrase: `My goal today is to practice: ${goal}.`,
                naturalTranslation: `Meu objetivo hoje e praticar: ${goal}.`,
                pronunciationHint: "Pause briefly after 'today' and finish with confidence.",
                chunks: [
                    { text: "My goal today", meaning: "Meu objetivo hoje" },
                    { text: "is to practice", meaning: "e praticar" },
                ],
            },
        ],
        [
            {
                id: `plan-shadowing-${dailyPlan.date}-${rotation}-1`,
                phrase: "I need to confirm the priority before I continue.",
                naturalTranslation: "Eu preciso confirmar a prioridade antes de continuar.",
                pronunciationHint: "Connect 'need to' naturally, close to 'needta'.",
                chunks: [
                    { text: "I need to confirm", meaning: "Eu preciso confirmar" },
                    { text: "the priority", meaning: "a prioridade" },
                    { text: "before I continue", meaning: "antes de continuar" },
                ],
            },
            {
                id: `plan-shadowing-${dailyPlan.date}-${rotation}-2`,
                phrase: "Could you give me one example, please?",
                naturalTranslation: "Voce poderia me dar um exemplo, por favor?",
                pronunciationHint: "Reduce 'could you' and stress 'one example'.",
                chunks: [
                    { text: "Could you give me", meaning: "Voce poderia me dar" },
                    { text: "one example", meaning: "um exemplo" },
                    { text: "please", meaning: "por favor" },
                ],
            },
        ],
    ];
    return sets[rotation % sets.length];
};
const buildPlanVocabulary = (user, dailyPlan) => {
    const rotation = getPlanRotation(dailyPlan);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 2);
    return [
        {
            id: `plan-vocab-${dailyPlan.date}-${rotation}-1`,
            phrase: "I need to confirm one detail first.",
            translation: "Preciso confirmar um detalhe primeiro.",
            level: user.currentLevel,
            category: "Current plan",
            sentences: [
                { text: "I need to confirm one detail first.", translation: "Preciso confirmar um detalhe primeiro." },
                { text: "I need to confirm the priority.", translation: "Preciso confirmar a prioridade." },
                { text: "I need to confirm the deadline.", translation: "Preciso confirmar o prazo." },
            ],
            confidence: 50,
            nextReviewAt: nextReview.toISOString(),
            hits: 0,
            misses: 0,
            source: "plan_generated",
            timesPracticed: 0,
            timesCorrect: 0,
            timesWrong: 0,
        },
        {
            id: `plan-vocab-${dailyPlan.date}-${rotation}-2`,
            phrase: "I can explain my next step clearly.",
            translation: "Eu consigo explicar meu proximo passo com clareza.",
            level: user.currentLevel,
            category: "Current plan",
            sentences: [
                { text: "I can explain my next step clearly.", translation: "Eu consigo explicar meu proximo passo com clareza." },
                { text: "I can explain the blocker clearly.", translation: "Eu consigo explicar o bloqueio com clareza." },
                { text: "I can explain the expected result clearly.", translation: "Eu consigo explicar o resultado esperado com clareza." },
            ],
            confidence: 50,
            nextReviewAt: nextReview.toISOString(),
            hits: 0,
            misses: 0,
            source: "plan_generated",
            timesPracticed: 0,
            timesCorrect: 0,
            timesWrong: 0,
        },
    ];
};
const buildPlanThinkPrompt = (dailyPlan) => ({
    id: `plan-think-${dailyPlan.date}-${getPlanRotation(dailyPlan)}`,
    userMessage: "Quero falar sobre meu plano de estudo de hoje.",
    coachReply: "Start in English with one short sentence: Today, I want to practice...",
});
const toPlainVocabulary = (item) => ({
    id: String(item._id ?? item.id),
    phrase: item.phrase,
    translation: item.translation,
    level: item.level,
    category: item.category,
    sentences: item.sentences,
    confidence: item.confidence,
    nextReviewAt: item.nextReviewAt instanceof Date ? item.nextReviewAt.toISOString() : item.nextReviewAt,
    hits: item.hits,
    misses: item.misses,
    source: item.source ?? "user_saved",
    timesPracticed: item.timesPracticed ?? item.hits + item.misses,
    timesCorrect: item.timesCorrect ?? item.hits,
    timesWrong: item.timesWrong ?? item.misses,
});
const hydrateListeningLessons = (lessons = []) => {
    const seedById = new Map(seedData_1.dashboardSeed.listeningLessons.map((lesson) => [lesson.id, lesson]));
    return lessons.map((lesson) => {
        const seedLesson = seedById.get(lesson.id);
        if (!seedLesson) {
            return lesson;
        }
        return {
            ...seedLesson,
            ...lesson,
            imageUrl: lesson.imageUrl ?? seedLesson.imageUrl,
            imageSource: lesson.imageSource ?? seedLesson.imageSource,
            imageAlt: lesson.imageAlt ?? seedLesson.imageAlt,
            situationDescription: lesson.situationDescription ?? seedLesson.situationDescription,
            comprehension: lesson.comprehension?.length ? lesson.comprehension : seedLesson.comprehension,
        };
    });
};
class ContentRepository {
    async seedCatalogIfNeeded() {
        const [vocabularyCount, catalogCount] = await Promise.all([
            vocabularyItem_model_1.VocabularyItemModel.countDocuments(),
            contentCatalog_model_1.ContentCatalogModel.countDocuments(),
        ]);
        if (vocabularyCount === 0) {
            await vocabularyItem_model_1.VocabularyItemModel.insertMany(seedData_1.dashboardSeed.vocabulary.map((item) => ({
                phrase: item.phrase,
                translation: item.translation,
                level: item.level,
                category: item.category,
                sentences: item.sentences,
                confidence: item.confidence,
                nextReviewAt: new Date(item.nextReviewAt),
                hits: item.hits,
                misses: item.misses,
            })));
        }
        if (catalogCount === 0) {
            await contentCatalog_model_1.ContentCatalogModel.insertMany([
                { key: "listeningLessons", items: seedData_1.dashboardSeed.listeningLessons },
                { key: "shadowingItems", items: seedData_1.dashboardSeed.shadowingItems },
                { key: "conversationModes", items: seedData_1.dashboardSeed.conversationModes },
                { key: "developerModes", items: seedData_1.dashboardSeed.developerModes },
                { key: "thinkInEnglishPrompts", items: seedData_1.dashboardSeed.thinkInEnglishPrompts },
            ]);
        }
    }
    async getLearningContent(userId) {
        await this.seedCatalogIfNeeded();
        const [vocabulary, catalogs] = await Promise.all([
            vocabularyItem_model_1.VocabularyItemModel.find({ userId }).sort({ createdAt: -1 }),
            contentCatalog_model_1.ContentCatalogModel.find(),
        ]);
        const byKey = new Map(catalogs.map((catalog) => [catalog.key, catalog.items]));
        return {
            vocabulary: vocabulary.map(toPlainVocabulary),
            listeningLessons: hydrateListeningLessons(byKey.get("listeningLessons") ?? seedData_1.dashboardSeed.listeningLessons),
            shadowingItems: byKey.get("shadowingItems") ?? [],
            conversationModes: byKey.get("conversationModes") ?? [],
            developerModes: byKey.get("developerModes") ?? [],
            thinkInEnglishPrompts: byKey.get("thinkInEnglishPrompts") ?? [],
        };
    }
    personalizeForPlan(content, user, dailyPlan) {
        const rotation = getPlanRotation(dailyPlan);
        return {
            vocabulary: uniqueBy([
                ...buildPlanVocabulary(user, dailyPlan),
                ...rotateItems(content.vocabulary, rotation),
            ], (item) => item.phrase),
            listeningLessons: uniqueBy([
                buildPlanListeningLesson(user, dailyPlan),
                ...rotateItems(content.listeningLessons, rotation),
            ], (item) => item.id),
            shadowingItems: uniqueBy([
                ...buildPlanShadowingItems(user, dailyPlan),
                ...rotateItems(content.shadowingItems, rotation),
            ], (item) => item.phrase),
            conversationModes: rotateItems(content.conversationModes, rotation),
            developerModes: rotateItems(content.developerModes, rotation),
            thinkInEnglishPrompts: [
                buildPlanThinkPrompt(dailyPlan),
                ...rotateItems(content.thinkInEnglishPrompts, rotation),
            ],
        };
    }
    async getDueReviewItems(userId) {
        const now = new Date();
        const schedules = await reviewSchedule_model_1.ReviewScheduleModel.find({
            userId,
            nextReviewAt: { $lte: now },
        })
            .sort({ nextReviewAt: 1 })
            .populate("vocabularyItemId");
        return schedules
            .map((schedule) => schedule.vocabularyItemId)
            .filter(Boolean)
            .map(toPlainVocabulary);
    }
    async recordVocabularyReview(userId, item, review) {
        const next = {
            confidence: review.confidence ?? item.confidence,
            nextReviewAt: review.nextReviewAt ?? item.nextReviewAt,
            hits: review.hits ?? item.hits,
            misses: review.misses ?? item.misses,
        };
        const timesPracticed = next.hits + next.misses;
        if (mongoose_1.default.connection.readyState !== 1) {
            return {
                ...item,
                ...next,
                timesPracticed,
                timesCorrect: next.hits,
                timesWrong: next.misses,
            };
        }
        const update = {
            $setOnInsert: {
                userId,
                phrase: item.phrase,
                translation: item.translation,
                level: item.level,
                category: item.category,
                sentences: item.sentences,
                source: item.source ?? "user_saved",
            },
            $set: {
                confidence: next.confidence,
                nextReviewAt: new Date(next.nextReviewAt),
                hits: next.hits,
                misses: next.misses,
                timesPracticed,
                timesCorrect: next.hits,
                timesWrong: next.misses,
            },
        };
        const saved = mongoose_1.default.Types.ObjectId.isValid(item.id)
            ? await vocabularyItem_model_1.VocabularyItemModel.findByIdAndUpdate(item.id, update, { new: true })
            : await vocabularyItem_model_1.VocabularyItemModel.findOneAndUpdate({ userId, phrase: item.phrase }, update, { new: true, upsert: true, setDefaultsOnInsert: true });
        if (!saved) {
            return null;
        }
        await reviewSchedule_model_1.ReviewScheduleModel.findOneAndUpdate({ userId, vocabularyItemId: saved._id }, {
            $set: {
                hits: saved.hits,
                misses: saved.misses,
                confidence: saved.confidence,
                nextReviewAt: saved.nextReviewAt,
            },
        }, { new: true, upsert: true });
        return toPlainVocabulary(saved);
    }
    async updateVocabularyReview(userId, itemId, review) {
        const item = await vocabularyItem_model_1.VocabularyItemModel.findByIdAndUpdate(itemId, {
            $set: {
                userId,
                ...(review.confidence !== undefined ? { confidence: review.confidence } : {}),
                ...(review.nextReviewAt ? { nextReviewAt: new Date(review.nextReviewAt) } : {}),
                ...(review.hits !== undefined ? { hits: review.hits } : {}),
                ...(review.misses !== undefined ? { misses: review.misses } : {}),
                ...(review.hits !== undefined ? { timesCorrect: review.hits } : {}),
                ...(review.misses !== undefined ? { timesWrong: review.misses } : {}),
                timesPracticed: (review.hits ?? 0) + (review.misses ?? 0),
            },
        }, { new: true });
        if (!item) {
            return null;
        }
        await reviewSchedule_model_1.ReviewScheduleModel.findOneAndUpdate({ userId, vocabularyItemId: item._id }, {
            $set: {
                hits: item.hits,
                misses: item.misses,
                confidence: item.confidence,
                nextReviewAt: item.nextReviewAt,
            },
        }, { new: true, upsert: true });
        return toPlainVocabulary(item);
    }
}
exports.ContentRepository = ContentRepository;
