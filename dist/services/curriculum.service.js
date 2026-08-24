"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessProficiency = exports.CEFR_CURRICULUM = void 0;
const levelOrder = ["A1", "A2", "B1", "B2", "C1"];
exports.CEFR_CURRICULUM = [
    { id: "a1-listening-routines", level: "A1", skill: "listening", statement: "Entende palavras e frases muito frequentes em instruções e rotinas simples.", evidence: "Acerta o sentido principal de áudios curtos, sem transcrição." },
    { id: "a1-speaking-basic-needs", level: "A1", skill: "speaking", statement: "Produz frases ensaiadas para se apresentar, pedir ajuda e responder informações básicas.", evidence: "Grava uma frase curta compreensível com o conteúdo-alvo." },
    { id: "a1-vocabulary-survival", level: "A1", skill: "vocabulary", statement: "Recupera expressões de sobrevivência e rotina em contexto.", evidence: "Recorda frases em revisões espaçadas." },
    { id: "a1-pronunciation-intelligible", level: "A1", skill: "pronunciation", statement: "É compreensível ao dizer palavras e frases familiares devagar.", evidence: "Análise de fala mostra inteligibilidade básica em tentativas diferentes." },
    { id: "a2-listening-everyday", level: "A2", skill: "listening", statement: "Entende a ideia principal de conversas curtas sobre trabalho, compras e planos.", evidence: "Compreende áudios curtos em velocidade normal com pouco apoio." },
    { id: "a2-speaking-connected", level: "A2", skill: "speaking", statement: "Liga frases simples para descrever experiências, planos e preferências.", evidence: "Responde com mais de uma frase em situações previsíveis." },
    { id: "a2-vocabulary-functional", level: "A2", skill: "vocabulary", statement: "Usa vocabulário funcional frequente para necessidades cotidianas e trabalho conhecido.", evidence: "Recupera itens em revisão e os escolhe corretamente em contexto." },
    { id: "a2-interaction-clarification", level: "A2", skill: "interaction", statement: "Faz perguntas simples e pede esclarecimento quando necessário.", evidence: "Mantém ao menos dois turnos de uma conversa guiada." },
    { id: "b1-listening-workplace", level: "B1", skill: "listening", statement: "Entende os pontos principais de falas claras sobre assuntos familiares e trabalho.", evidence: "Identifica intenção, decisão ou próximos passos em áudios sem tradução." },
    { id: "b1-speaking-explanation", level: "B1", skill: "speaking", statement: "Explica experiências, opiniões e decisões com razões curtas.", evidence: "Produz fala conectada em tarefas abertas com feedback consistente." },
    { id: "b1-vocabulary-flexible", level: "B1", skill: "vocabulary", statement: "Usa expressões para contornar lacunas e explicar um ponto conhecido.", evidence: "Recupera e reaplica vocabulário em cenários novos." },
    { id: "b1-pronunciation-flow", level: "B1", skill: "pronunciation", statement: "Mantém ritmo e entonação suficientemente claros para interação habitual.", evidence: "Pontuações de fala estáveis em várias frases não ensaiadas." },
    { id: "b2-listening-detail", level: "B2", skill: "listening", statement: "Acompanha argumentação e detalhes relevantes em fala normal sobre temas conhecidos.", evidence: "Distingue detalhes e implicações em tarefas de compreensão." },
    { id: "b2-speaking-discussion", level: "B2", skill: "speaking", statement: "Defende um ponto de vista e responde a perguntas de acompanhamento com autonomia.", evidence: "Sustenta conversa de trabalho sem roteiro rígido." },
    { id: "b2-interaction-repair", level: "B2", skill: "interaction", statement: "Negocia sentido, reformula e corrige mal-entendidos durante a conversa.", evidence: "Usa estratégias de reparo em diálogos avaliados." },
    { id: "c1-speaking-precision", level: "C1", skill: "speaking", statement: "Expressa ideias complexas com fluência e precisão adequadas ao contexto.", evidence: "Desempenho consistente em tarefas abertas variadas." },
];
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
const scoreStatus = (score, observations) => score === null || observations < 3 ? "not_enough_data" : score >= 70 && observations >= 6 ? "secure" : "developing";
/**
 * Converts actual product evidence into a transparent working estimate. Scores
 * are intentionally not a CEFR test: promotion requires calibrated tasks.
 */
const assessProficiency = (input) => {
    const listeningScore = input.listening.length
        ? input.listening.reduce((sum, item) => sum + (item.comprehensionCorrect ? 100 : 0) - (item.transcriptOpened ? 12 : 0) - (item.translationOpened ? 15 : 0) - Math.min(15, (item.replayCount ?? 0) * 3) - Math.min(10, (item.unknownWords?.length ?? 0) * 2), 0) / input.listening.length
        : null;
    const speakingScore = input.speaking.length
        ? input.speaking.reduce((sum, item) => sum + ((item.pronunciationScore ?? 0) + (item.naturalnessScore ?? 0) + (item.fluencyScore ?? 0)) / 3 * 10, 0) / input.speaking.length
        : null;
    const pronunciationScore = input.speaking.length
        ? input.speaking.reduce((sum, item) => sum + (item.pronunciationScore ?? 0) * 10, 0) / input.speaking.length
        : null;
    const vocabularyObservations = input.vocabulary.reduce((sum, item) => sum + Math.max(item.timesPracticed ?? 0, (item.hits ?? 0) + (item.misses ?? 0)), 0);
    const vocabularyScore = vocabularyObservations
        ? input.vocabulary.reduce((sum, item) => sum + (item.timesCorrect ?? item.hits ?? 0), 0) / vocabularyObservations * 100
        : null;
    const skillEvidence = {
        listening: { score: listeningScore === null ? null : clamp(listeningScore), observations: input.listening.length, status: scoreStatus(listeningScore, input.listening.length) },
        speaking: { score: speakingScore === null ? null : clamp(speakingScore), observations: input.speaking.length, status: scoreStatus(speakingScore, input.speaking.length) },
        vocabulary: { score: vocabularyScore === null ? null : clamp(vocabularyScore), observations: vocabularyObservations, status: scoreStatus(vocabularyScore, vocabularyObservations) },
        pronunciation: { score: pronunciationScore === null ? null : clamp(pronunciationScore), observations: input.speaking.length, status: scoreStatus(pronunciationScore, input.speaking.length) },
        interaction: { score: input.completedInteractions ? Math.min(100, input.completedInteractions * 20) : null, observations: input.completedInteractions, status: scoreStatus(input.completedInteractions ? Math.min(100, input.completedInteractions * 20) : null, input.completedInteractions) },
    };
    const evidenceCount = input.listening.length + input.speaking.length + vocabularyObservations + input.completedInteractions;
    const confidence = evidenceCount < 6 ? "insufficient" : evidenceCount < 20 ? "early" : evidenceCount < 45 ? "developing" : "supported";
    const coreSkills = [skillEvidence.listening, skillEvidence.speaking, skillEvidence.vocabulary];
    const observedCoreSkills = coreSkills.filter((skill) => skill.status !== "not_enough_data");
    const calibrated = confidence === "supported" && observedCoreSkills.length >= 2;
    const currentIndex = levelOrder.indexOf(input.profile.currentLevel);
    const averageCoreScore = observedCoreSkills.length
        ? observedCoreSkills.reduce((sum, skill) => sum + (skill.score ?? 0), 0) / observedCoreSkills.length
        : null;
    // We may flag that a declared working level is too difficult after substantial
    // evidence, but never promote above it until the learner completes calibrated
    // tasks at the next CEFR band.
    const estimatedLevel = calibrated && averageCoreScore !== null && averageCoreScore < 50 && currentIndex > 0
        ? levelOrder[currentIndex - 1]
        : input.profile.currentLevel;
    const estimatedIndex = levelOrder.indexOf(estimatedLevel);
    const nextLevel = levelOrder[Math.min(levelOrder.length - 1, estimatedIndex + 1)];
    const weakest = Object.entries(skillEvidence)
        .sort(([, a], [, b]) => (a.score ?? -1) - (b.score ?? -1))[0]?.[0];
    const nextCompetencies = exports.CEFR_CURRICULUM
        .filter((item) => item.level === estimatedLevel && (item.skill === weakest || item.skill === "interaction"))
        .concat(exports.CEFR_CURRICULUM.filter((item) => item.level === nextLevel && item.skill === weakest).slice(0, 1))
        .slice(0, 3);
    return {
        estimatedLevel,
        confidence,
        calibrated,
        evidenceCount,
        assessedAt: new Date().toISOString(),
        skillEvidence,
        nextCompetencies,
        explanation: calibrated
            ? `Estimativa de trabalho ${estimatedLevel}, sustentada por evidências recentes da plataforma. Para avançar de nível, ainda serão necessárias tarefas calibradas no próximo nível CEFR. Não substitui uma certificação.`
            : `Nível de trabalho ${input.profile.currentLevel}; ainda faltam tentativas avaliáveis e variadas para confirmar esse nível com segurança.`,
    };
};
exports.assessProficiency = assessProficiency;
