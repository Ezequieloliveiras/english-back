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
const trainingPhrase_1 = require("../utils/trainingPhrase");
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
const normalizeContentKey = (value) => value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const stableContentId = (prefix, text) => {
    let hash = 0;
    for (const character of normalizeContentKey(text)) {
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return `${prefix}-${hash.toString(36)}`;
};
const numericDateSeed = (date) => date.split("-").reduce((sum, part) => sum + Number(part), 0);
const normalizeGoalText = (value) => value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const looksPortuguese = (value) => {
    const normalized = normalizeGoalText(value);
    return /\b(falar|fala|reuniao|reunioes|entrevista|entrevistas|trabalho|ingles|melhor|melhorar|praticar|viagem|viajar|atendimento|vendas|negocios|conversa|conversacao|pronuncia|escuta|ouvir)\b/.test(normalized);
};
const goalIncludes = (normalized, terms) => terms.some((term) => normalized.includes(term));
const buildGoalContext = (goal) => {
    const original = safeText(goal, "falar com mais confiança");
    const normalized = normalizeGoalText(original);
    const englishParts = [];
    const portugueseParts = [];
    if (goalIncludes(normalized, ["reuniao", "reunioes", "meeting", "meetings"])) {
        englishParts.push("meetings");
        portugueseParts.push("reuniões");
    }
    if (goalIncludes(normalized, ["entrevista", "entrevistas", "interview", "interviews"])) {
        englishParts.push("interviews");
        portugueseParts.push("entrevistas");
    }
    if (goalIncludes(normalized, ["apresentacao", "apresentacoes", "presentation", "presentations"])) {
        englishParts.push("presentations");
        portugueseParts.push("apresentações");
    }
    if (goalIncludes(normalized, ["conversa", "conversacao", "conversation", "conversations"])) {
        englishParts.push("conversations");
        portugueseParts.push("conversas");
    }
    if (goalIncludes(normalized, ["trabalho", "profissional", "work", "professional"])) {
        englishParts.push("work situations");
        portugueseParts.push("situações de trabalho");
    }
    if (goalIncludes(normalized, ["viagem", "viajar", "travel", "trip"])) {
        englishParts.push("travel situations");
        portugueseParts.push("situações de viagem");
    }
    if (goalIncludes(normalized, ["vendas", "sales"])) {
        englishParts.push("sales conversations");
        portugueseParts.push("conversas de vendas");
    }
    const englishPurpose = englishParts.length
        ? englishParts.length === 1
            ? englishParts[0]
            : `${englishParts.slice(0, -1).join(", ")} and ${englishParts[englishParts.length - 1]}`
        : looksPortuguese(original)
            ? "my current speaking goal"
            : original;
    const portuguesePurpose = portugueseParts.length
        ? portugueseParts.length === 1
            ? portugueseParts[0]
            : `${portugueseParts.slice(0, -1).join(", ")} e ${portugueseParts[portugueseParts.length - 1]}`
        : original;
    return {
        englishPurpose,
        portuguesePurpose,
        englishGoalSentence: `I want to practice English for ${englishPurpose}.`,
        portugueseGoalSentence: `Eu quero praticar inglês para ${portuguesePurpose}.`,
    };
};
const normalizeProfessionText = (value) => value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const professionalTermTranslations = {
    access: "acesso",
    "api": "API",
    audience: "público",
    blocker: "bloqueio",
    "brand message": "mensagem da marca",
    bug: "problema",
    campaign: "campanha",
    "content calendar": "calendário de conteúdo",
    conversion: "conversão",
    "customer context": "contexto do cliente",
    deadline: "prazo",
    "decision maker": "pessoa responsável pela decisão",
    deployment: "implantação",
    "edge case": "caso extremo",
    escalation: "escalonamento",
    feedback: "retorno",
    "follow-up": "acompanhamento",
    layout: "leiaute",
    lead: "potencial cliente",
    objection: "objeção",
    priority: "prioridade",
    proposal: "proposta",
    prototype: "protótipo",
    "pull request": "solicitação de revisão",
    resolution: "resolução",
    result: "resultado",
    "response time": "tempo de resposta",
    stakeholder: "parte interessada",
    "staging logs": "logs do ambiente de homologação",
    "next step": "próximo passo",
    "user flow": "fluxo do usuário",
    "visual hierarchy": "hierarquia visual",
};
const professionalAreaTranslations = {
    "customer support": "suporte ao cliente",
    design: "design",
    designer: "design",
    developer: "desenvolvimento de software",
    doctor: "medicina",
    engineer: "engenharia",
    marketing: "marketing",
    physician: "medicina",
    sales: "vendas",
    "software development": "desenvolvimento de software",
    support: "suporte ao cliente",
    teacher: "educação",
    vendas: "vendas",
};
const translateProfessionalTerm = (term) => professionalTermTranslations[normalizeProfessionText(term)] ?? term;
const translateProfessionalArea = (area) => {
    const normalized = normalizeProfessionText(area);
    if (professionalAreaTranslations[normalized]) {
        return professionalAreaTranslations[normalized];
    }
    return looksPortuguese(area) ? area : "sua área profissional";
};
const professionalProfile = (user) => {
    const profession = safeText(user.profession, "work");
    const goalContext = buildGoalContext(user.primaryGoal);
    if (user.professionalFocusMode !== "profession") {
        return {
            enabled: false,
            area: profession,
            scenario: `A short work conversation about priorities in ${profession}.`,
            task: `${profession} task`,
            terms: ["priority", "deadline", "next step"],
            phrases: [
                "I can explain the next step in simple English.",
                `My goal today is to practice ${goalContext.englishPurpose}.`,
            ],
        };
    }
    const normalized = normalizeProfessionText(profession);
    if (normalized.includes("marketing") || normalized.includes("growth") || normalized.includes("social media")) {
        return {
            enabled: true,
            area: "marketing",
            scenario: "A marketing check-in about campaign performance, audience, and next actions.",
            task: "marketing campaign",
            terms: ["campaign", "audience", "conversion", "content calendar", "brand message"],
            phrases: [
                "The campaign needs a clearer message for this audience.",
                "I will compare the conversion rate before changing the content.",
            ],
        };
    }
    if (normalized.includes("sales") || normalized.includes("vendas")) {
        return {
            enabled: true,
            area: "sales",
            scenario: "A sales conversation about leads, objections, follow-up, and proposals.",
            task: "sales pipeline",
            terms: ["lead", "objection", "proposal", "follow-up", "decision maker"],
            phrases: [
                "I need to understand the customer's main objection.",
                "I will send a clear follow-up with the next step.",
            ],
        };
    }
    if (normalized.includes("support") || normalized.includes("suporte") || normalized.includes("customer success")) {
        return {
            enabled: true,
            area: "customer support",
            scenario: "A support conversation about tickets, escalation, customer context, and resolution.",
            task: "customer support case",
            terms: ["ticket", "escalation", "resolution", "customer context", "response time"],
            phrases: [
                "I need more context before I escalate this ticket.",
                "I will explain the solution clearly to the customer.",
            ],
        };
    }
    if (normalized.includes("developer") || normalized.includes("desenvolvedor") || normalized.includes("engineer")) {
        return {
            enabled: true,
            area: "software development",
            scenario: "A technical conversation about a task, bug, API, review, or deployment.",
            task: "technical task",
            terms: ["bug", "API", "pull request", "deployment", "edge case"],
            phrases: [
                "I can explain the issue and suggest a solution.",
                "I need to check the API response before I continue.",
            ],
        };
    }
    if (normalized.includes("design") || normalized.includes("designer")) {
        return {
            enabled: true,
            area: "design",
            scenario: "A design review about layout, user flow, visual hierarchy, and feedback.",
            task: "design review",
            terms: ["layout", "user flow", "visual hierarchy", "feedback", "prototype"],
            phrases: [
                "The layout should make the main action clearer.",
                "I will update the prototype after the feedback.",
            ],
        };
    }
    return {
        enabled: true,
        area: profession,
        scenario: `A realistic professional conversation in ${profession}.`,
        task: `${profession} task`,
        terms: ["priority", "stakeholder", "deadline", "result", "next step"],
        phrases: [
            `I need to clarify the priority for this ${profession} task.`,
            `I can explain the result in simple English for my ${profession} context.`,
        ],
    };
};
const buildPlanScenario = (user, dailyPlan) => {
    const rotation = getPlanRotation(dailyPlan);
    const goal = buildGoalContext(user.primaryGoal);
    const profile = professionalProfile(user);
    const scenarios = [
        {
            title: "Planning the Next Task",
            situation: profile.scenario,
            dialogue: [
                "Manager: What is your main focus for this session?",
                `Student: ${goal.englishGoalSentence}`,
                "Manager: Good. What is one small task you can finish now?",
                `Student: ${profile.phrases[0]}`,
            ],
            translations: [
                "Qual é o seu foco principal nesta sessão?",
                goal.portugueseGoalSentence,
                "Certo. Qual é uma pequena tarefa que você consegue terminar agora?",
                translateGeneratedPhrase(profile.phrases[0], profile.area),
            ],
            questions: [
                { prompt: "What does the student want to practice?", answer: goal.englishPurpose },
                { prompt: "What can the student explain?", answer: "The next step in simple English." },
            ],
        },
        {
            title: "Explaining a Blocker",
            situation: profile.enabled
                ? `A teammate asks for a clear ${profile.area} update.`
                : "A teammate asks for a clear update about a blocker.",
            dialogue: [
                "Teammate: Are you blocked on anything right now?",
                "Student: Yes, I need more context before I continue.",
                "Teammate: What context do you need?",
                `Student: I need the goal and the expected result for this ${profile.task}.`,
            ],
            translations: [
                "Você está bloqueado em alguma coisa agora?",
                "Sim, eu preciso de mais contexto antes de continuar.",
                "De que contexto você precisa?",
                `Eu preciso do objetivo e do resultado esperado para esta tarefa de ${profile.area}.`,
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
                "O que você praticou neste ciclo?",
                "Eu pratiquei respostas curtas e frases úteis de trabalho.",
                "O que você deve fazer agora?",
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
                "Você consegue cuidar disso hoje?",
                "Eu consigo, mas preciso confirmar um detalhe primeiro.",
                "Claro. O que você quer confirmar?",
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
        return [{ text, translation: translation }];
    }
    const middle = Math.ceil(words.length / 2);
    return [
        { text: words.slice(0, middle).join(" "), translation: translation },
        { text: words.slice(middle).join(" "), translation: "parte final da ideia" },
    ];
};
const buildShadowingItem = (item) => ({
    id: item.id,
    text: item.text,
    translation: item.translation,
    explanation: item.explanation ?? `Use esta frase em uma situação prática: ${item.translation}`,
    chunks: item.chunks ?? chunkByPhrase(item.text, item.translation),
    pronunciationTip: item.pronunciationTip,
    language: "en",
    translationLanguage: "pt-BR",
    ...(item.additionalExample ? { additionalExample: item.additionalExample } : {}),
});
const translateGeneratedPhrase = (phrase, area) => {
    const areaPtBr = translateProfessionalArea(area);
    const translations = {
        "I can explain the next step in simple English.": "Eu consigo explicar o próximo passo em inglês simples.",
        "The campaign needs a clearer message for this audience.": "A campanha precisa de uma mensagem mais clara para esse público.",
        "I will compare the conversion rate before changing the content.": "Vou comparar a taxa de conversão antes de mudar o conteúdo.",
        "I need to understand the customer's main objection.": "Eu preciso entender a principal objeção do cliente.",
        "I will send a clear follow-up with the next step.": "Vou enviar um acompanhamento claro com o próximo passo.",
        "I need more context before I escalate this ticket.": "Eu preciso de mais contexto antes de encaminhar esse chamado.",
        "I will explain the solution clearly to the customer.": "Vou explicar a solução com clareza para o cliente.",
        "I can explain the issue and suggest a solution.": "Eu consigo explicar o problema e sugerir uma solução.",
        "I need to check the API response before I continue.": "Eu preciso verificar a resposta da API antes de continuar.",
        "The layout should make the main action clearer.": "O leiaute deve deixar a ação principal mais clara.",
        "I will update the prototype after the feedback.": "Vou atualizar o protótipo depois do retorno.",
    };
    if (translations[phrase]) {
        return translations[phrase];
    }
    if (phrase.startsWith("I need to clarify the priority for this")) {
        return `Eu preciso esclarecer a prioridade desta tarefa de ${areaPtBr}.`;
    }
    if (phrase.startsWith("I can explain the result in simple English")) {
        return `Eu consigo explicar o resultado em inglês simples no contexto de ${areaPtBr}.`;
    }
    if (phrase.startsWith("My goal today is to practice")) {
        return "Meu objetivo hoje é praticar esse foco em inglês.";
    }
    return `Frase útil para ${areaPtBr}.`;
};
const buildShadowingCandidates = (user, dailyPlan) => {
    const goal = buildGoalContext(user.primaryGoal);
    const profile = professionalProfile(user);
    const area = profile.area;
    const areaPtBr = translateProfessionalArea(area);
    const terms = profile.terms.length ? profile.terms : ["priority", "deadline", "next step"];
    const primaryTerm = terms[0] ?? "priority";
    const secondaryTerm = terms[1] ?? "deadline";
    const tertiaryTerm = terms[2] ?? "next step";
    const primaryTermPtBr = translateProfessionalTerm(primaryTerm);
    const secondaryTermPtBr = translateProfessionalTerm(secondaryTerm);
    const tertiaryTermPtBr = translateProfessionalTerm(tertiaryTerm);
    const specs = [
        {
            text: profile.phrases[0],
            translation: translateGeneratedPhrase(profile.phrases[0], area),
            explanation: `Use em atualizações de ${areaPtBr}.`,
            tip: "Destaque o termo profissional principal e mantenha o final claro.",
        },
        {
            text: profile.enabled ? profile.phrases[1] : goal.englishGoalSentence,
            translation: profile.enabled ? translateGeneratedPhrase(profile.phrases[1], area) : goal.portugueseGoalSentence,
            explanation: "Use para transformar seu objetivo em uma frase curta e treinável.",
            tip: "Faça uma pausa breve depois da ideia principal e termine com confiança.",
        },
        {
            text: `I need to clarify the ${primaryTerm} before I continue.`,
            translation: `Eu preciso esclarecer ${primaryTermPtBr} antes de continuar.`,
            explanation: "Use quando falta uma informação importante para seguir.",
            tip: "Conecte 'need to' naturalmente, próximo de 'needta'.",
        },
        {
            text: `The ${secondaryTerm} is important for the next step.`,
            translation: `${secondaryTermPtBr} é importante para o próximo passo.`,
            explanation: "Use para explicar por que uma informação afeta a próxima ação.",
            tip: "Dê ênfase ao termo principal e finalize 'next step' com clareza.",
        },
        {
            text: `I will update the team after I check the ${tertiaryTerm}.`,
            translation: `Vou atualizar a equipe depois de verificar ${tertiaryTermPtBr}.`,
            explanation: "Use quando você promete retorno depois de confirmar uma informação.",
            tip: "Mantenha 'will update' conectado e claro.",
        },
        {
            text: `Can you confirm the ${primaryTerm} for this ${area} task?`,
            translation: `Você pode confirmar ${primaryTermPtBr} para esta tarefa de ${areaPtBr}?`,
            explanation: "Use para pedir confirmação de forma direta e educada.",
            tip: "Reduza 'can you' naturalmente e destaque a informação pedida.",
        },
        {
            text: `I can explain the result in simple English.`,
            translation: "Eu consigo explicar o resultado em inglês simples.",
            explanation: "Use para praticar clareza antes de falar com mais detalhes.",
            tip: "Dê ritmo a 'simple English' sem correr.",
        },
        {
            text: `I am working on the ${tertiaryTerm} now.`,
            translation: `Estou trabalhando em ${tertiaryTermPtBr} agora.`,
            explanation: "Use para dar uma atualização curta sobre o que você está fazendo.",
            tip: "Conecte 'working on' de forma fluida.",
        },
        {
            text: "I need one more example before I decide.",
            translation: "Preciso de mais um exemplo antes de decidir.",
            explanation: "Use quando você precisa de mais evidência antes de escolher.",
            tip: "Dê ênfase a 'one more example'.",
        },
        {
            text: "I can give you a quick update now.",
            translation: "Posso te dar uma atualização rápida agora.",
            explanation: "Use para iniciar uma atualização curta em contexto profissional.",
            tip: "Mantenha 'quick update' como um bloco só.",
        },
        {
            text: "I want to make sure I understand the goal.",
            translation: "Quero garantir que entendi o objetivo.",
            explanation: "Use quando você quer confirmar entendimento antes de agir.",
            tip: "Fale 'make sure' como uma unidade natural.",
        },
        {
            text: "I will practice this phrase again during review.",
            translation: "Vou praticar esta frase novamente durante a revisão.",
            explanation: "Use para marcar uma frase como revisão intencional.",
            tip: "Dê uma pausa leve antes de 'during review'.",
        },
    ];
    return specs.map((spec) => buildShadowingItem({
        id: stableContentId("shadowing", spec.text),
        text: spec.text,
        translation: spec.translation,
        explanation: spec.explanation,
        pronunciationTip: spec.tip,
        chunks: chunkByPhrase(spec.text, spec.translation),
    }));
};
const selectShadowingItems = (candidates, catalogItems, dailyPlan, history = {}) => {
    const completed = (history.completedActivities ?? [])
        .filter((activity) => activity.type === "shadowing" || activity.type === "repetition")
        .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
    const trainedIds = new Set(completed.map((activity) => activity.itemId));
    const trainedTexts = new Set(completed.map((activity) => normalizeContentKey(activity.title)));
    const recentlyTrainedTexts = new Set(completed.slice(0, 12).map((activity) => normalizeContentKey(activity.title)));
    const seed = getPlanRotation(dailyPlan) + numericDateSeed(dailyPlan.date);
    const pool = rotateItems(uniqueBy([...candidates, ...catalogItems], (item) => item.text), seed);
    const fresh = pool.filter((item) => !trainedIds.has(item.id) && !trainedTexts.has(normalizeContentKey(item.text)));
    const review = pool.filter((item) => trainedIds.has(item.id) || trainedTexts.has(normalizeContentKey(item.text)));
    const spacedReview = review.filter((item) => !recentlyTrainedTexts.has(normalizeContentKey(item.text)));
    const selectedFresh = fresh.slice(0, 4);
    const selectedReview = spacedReview.slice(0, selectedFresh.length >= 3 ? 1 : 2);
    const selected = uniqueBy([...selectedFresh, ...selectedReview], (item) => item.text);
    if (selected.length >= 3) {
        return selected;
    }
    return uniqueBy([...selected, ...pool], (item) => item.text).slice(0, 4);
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
            const translation = scenario.translations[index] ?? "Tradução em português indisponível.";
            return {
                sourceText: text,
                translation,
                translationPtBr: translation,
                context: "Use esta frase como parte do ciclo atual de estudo.",
                chunks: chunkByPhrase(text, translation),
                pronunciationTip: "Mantenha a frase curta, clara e conectada.",
            };
        }),
    };
};
const buildPlanShadowingItems = (user, dailyPlan) => buildShadowingCandidates(user, dailyPlan);
const buildPlanVocabulary = (user, dailyPlan) => {
    const rotation = getPlanRotation(dailyPlan);
    const profile = professionalProfile(user);
    const primaryTerm = profile.terms[0] ?? "priority";
    const secondaryTerm = profile.terms[1] ?? "deadline";
    const primaryTermPtBr = translateProfessionalTerm(primaryTerm);
    const secondaryTermPtBr = translateProfessionalTerm(secondaryTerm);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 2);
    return [
        {
            id: `plan-vocab-${dailyPlan.date}-${rotation}-1`,
            phrase: profile.enabled ? `I need to clarify the ${primaryTerm} first.` : "I need to confirm one detail first.",
            translation: profile.enabled ? `Preciso esclarecer ${primaryTermPtBr} primeiro.` : "Preciso confirmar um detalhe primeiro.",
            level: user.currentLevel,
            category: profile.enabled ? `${profile.area} focus` : "Current plan",
            sentences: [
                { text: profile.phrases[0], translation: translateGeneratedPhrase(profile.phrases[0], profile.area) },
                { text: `I need to confirm the ${primaryTerm}.`, translation: `Preciso confirmar ${primaryTermPtBr}.` },
                { text: `The ${secondaryTerm} is important for the next step.`, translation: `${secondaryTermPtBr} é importante para o próximo passo.` },
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
            translation: "Eu consigo explicar meu próximo passo com clareza.",
            level: user.currentLevel,
            category: "Current plan",
            sentences: [
                { text: "I can explain my next step clearly.", translation: "Eu consigo explicar meu próximo passo com clareza." },
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
const hydrateShadowingItems = (items = []) => {
    const seedById = new Map(seedData_1.dashboardSeed.shadowingItems.map((item) => [item.id, item]));
    const seedByText = new Map(seedData_1.dashboardSeed.shadowingItems.map((item) => [item.text, item]));
    return items
        .map((item) => {
        const text = typeof item?.text === "string" ? item.text : item?.phrase;
        const fallback = seedById.get(item?.id) ?? seedByText.get(text) ?? undefined;
        const normalized = (0, trainingPhrase_1.normalizeShadowingItem)(item, fallback);
        if (!normalized?.translation) {
            return null;
        }
        return normalized;
    })
        .filter((item) => Boolean(item));
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
                source: "global_catalog",
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
            vocabularyItem_model_1.VocabularyItemModel.find({
                $or: [
                    { userId },
                    { userId: { $exists: false } },
                    { userId: null, source: "global_catalog" },
                ],
            }).sort({ userId: -1, createdAt: -1 }),
            contentCatalog_model_1.ContentCatalogModel.find(),
        ]);
        const byKey = new Map(catalogs.map((catalog) => [catalog.key, catalog.items]));
        return {
            vocabulary: vocabulary.map(toPlainVocabulary),
            listeningLessons: hydrateListeningLessons(byKey.get("listeningLessons") ?? seedData_1.dashboardSeed.listeningLessons),
            shadowingItems: hydrateShadowingItems(byKey.get("shadowingItems") ?? seedData_1.dashboardSeed.shadowingItems),
            conversationModes: byKey.get("conversationModes") ?? [],
            developerModes: byKey.get("developerModes") ?? [],
            thinkInEnglishPrompts: byKey.get("thinkInEnglishPrompts") ?? [],
        };
    }
    personalizeForPlan(content, user, dailyPlan, history = {}) {
        const rotation = getPlanRotation(dailyPlan);
        const shadowingCandidates = buildPlanShadowingItems(user, dailyPlan);
        return {
            vocabulary: uniqueBy([
                ...buildPlanVocabulary(user, dailyPlan),
                ...rotateItems(content.vocabulary, rotation),
            ], (item) => item.phrase),
            listeningLessons: uniqueBy([
                buildPlanListeningLesson(user, dailyPlan),
                ...rotateItems(content.listeningLessons, rotation),
            ], (item) => item.id),
            shadowingItems: selectShadowingItems(shadowingCandidates, rotateItems(content.shadowingItems, rotation), dailyPlan, history),
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
                source: item.source === "global_catalog" ? "user_reviewed_global" : item.source ?? "user_saved",
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
        const shouldUpdateById = mongoose_1.default.Types.ObjectId.isValid(item.id) && item.source !== "global_catalog";
        const saved = shouldUpdateById
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
