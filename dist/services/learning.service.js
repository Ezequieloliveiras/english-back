"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningService = void 0;
const dailyPlan_model_1 = require("../models/dailyPlan.model");
const diagnosticAttempt_model_1 = require("../models/diagnosticAttempt.model");
const competencyProgress_model_1 = require("../models/competencyProgress.model");
const userLevelProgress_model_1 = require("../models/userLevelProgress.model");
const user_model_1 = require("../models/user.model");
const learningRoadmap_1 = require("../data/learningRoadmap");
const todayKey = () => new Date().toISOString().slice(0, 10);
const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));
const toIsoOrNull = (value) => {
    if (!value) {
        return null;
    }
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};
const normalizeCEFRLevel = (level) => {
    const value = (level ?? "").toUpperCase();
    if (learningRoadmap_1.cefrSequence.includes(value)) {
        return value;
    }
    if (value.startsWith("A2")) {
        return "A2.1";
    }
    if (value.startsWith("B1")) {
        return "B1.1";
    }
    if (value.startsWith("B2") || value.startsWith("C")) {
        return "B2.1";
    }
    return "A1.1";
};
const getNextLevel = (level) => {
    const index = learningRoadmap_1.cefrSequence.indexOf(level);
    return index >= 0 ? learningRoadmap_1.cefrSequence[Math.min(index + 1, learningRoadmap_1.cefrSequence.length - 1)] : "A1.1";
};
const getTargetLevel = (level, desired) => {
    const normalized = normalizeCEFRLevel(desired);
    const currentIndex = learningRoadmap_1.cefrSequence.indexOf(level);
    const targetIndex = learningRoadmap_1.cefrSequence.indexOf(normalized);
    return targetIndex > currentIndex ? normalized : "B2.2";
};
const calculateListeningScore = (input) => {
    const comprehensionAccuracy = input.comprehensionCorrect ? 100 : 0;
    const firstAttemptAccuracy = input.comprehensionCorrect && (input.replayCount ?? 0) === 0 ? 100 : 0;
    const noTranscriptBonus = !input.transcriptOpened && !input.translationOpened ? 100 : 0;
    const detailAccuracy = input.detailAccuracy ?? comprehensionAccuracy;
    const responseTimeScore = input.responseTimeScore ?? Math.max(35, 100 - (input.replayCount ?? 0) * 12);
    const slowPenalty = input.slowAudioUsed ? 6 : 0;
    return clampScore(comprehensionAccuracy * 0.45 +
        firstAttemptAccuracy * 0.2 +
        noTranscriptBonus * 0.15 +
        detailAccuracy * 0.1 +
        responseTimeScore * 0.1 -
        slowPenalty);
};
const mapProgress = (progress) => ({
    userId: String(progress.userId),
    competencyId: progress.competencyId,
    masteryScore: progress.masteryScore,
    retentionScore: progress.retentionScore,
    confidenceScore: progress.confidenceScore,
    attempts: progress.attempts,
    successfulAttempts: progress.successfulAttempts,
    lastPracticedAt: toIsoOrNull(progress.lastPracticedAt),
    lastAssessedAt: toIsoOrNull(progress.lastAssessedAt),
    masteredAt: toIsoOrNull(progress.masteredAt),
    status: progress.status,
    evidence: (progress.evidence ?? []).map((entry) => ({
        type: entry.type,
        score: entry.score,
        createdAt: toIsoOrNull(entry.createdAt) ?? new Date().toISOString(),
        sourceId: entry.sourceId,
        metadata: entry.metadata ?? {},
    })),
});
const categoryKey = (category) => {
    if (category === "thinking_in_english") {
        return "thinkingInEnglish";
    }
    return category;
};
class LearningService {
    getRoadmap() {
        return {
            levels: learningRoadmap_1.cefrLevels,
            competencies: learningRoadmap_1.competencies,
            units: learningRoadmap_1.learningUnits,
            checkpoints: learningRoadmap_1.checkpoints,
        };
    }
    getLevels() {
        return learningRoadmap_1.cefrLevels;
    }
    getLevel(level) {
        return learningRoadmap_1.cefrLevels.find((entry) => entry.code === normalizeCEFRLevel(level)) ?? null;
    }
    getCompetencies(level) {
        const normalizedLevel = level ? normalizeCEFRLevel(level) : null;
        return normalizedLevel
            ? learningRoadmap_1.competencies.filter((competency) => competency.level === normalizedLevel)
            : learningRoadmap_1.competencies;
    }
    getCompetency(id) {
        return learningRoadmap_1.competencies.find((competency) => competency.id === id || competency.code === id) ?? null;
    }
    getUnits(level) {
        const normalizedLevel = level ? normalizeCEFRLevel(level) : null;
        return normalizedLevel
            ? learningRoadmap_1.learningUnits.filter((unit) => unit.level === normalizedLevel)
            : learningRoadmap_1.learningUnits;
    }
    getUnit(id) {
        return learningRoadmap_1.learningUnits.find((unit) => unit.id === id) ?? null;
    }
    async getUserLevelProgress(userId) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) {
            return null;
        }
        const currentLevel = normalizeCEFRLevel(user.currentLevel);
        const level = learningRoadmap_1.cefrLevels.find((entry) => entry.code === currentLevel) ?? learningRoadmap_1.cefrLevels[0];
        const required = level.requiredCompetencies;
        const progressEntries = await competencyProgress_model_1.CompetencyProgressModel.find({
            userId,
            competencyId: { $in: required },
        });
        const competenciesMastered = progressEntries.filter((entry) => entry.status === "mastered").length;
        const competenciesRequired = required.length;
        const levelProgress = competenciesRequired
            ? clampScore((competenciesMastered / competenciesRequired) * 100)
            : 0;
        const checkpointStatus = levelProgress >= 80 ? "available" : "locked";
        const saved = await userLevelProgress_model_1.UserLevelProgressModel.findOneAndUpdate({ userId }, {
            $setOnInsert: {
                startedAt: new Date(),
                completedAt: null,
            },
            $set: {
                currentLevel,
                targetLevel: getTargetLevel(currentLevel, user.primaryGoal),
                levelProgress,
                competenciesMastered,
                competenciesRequired,
                checkpointStatus,
            },
        }, { new: true, upsert: true });
        return {
            userId: String(saved.userId),
            currentLevel: normalizeCEFRLevel(saved.currentLevel),
            targetLevel: normalizeCEFRLevel(saved.targetLevel),
            levelProgress: saved.levelProgress,
            competenciesMastered: saved.competenciesMastered,
            competenciesRequired: saved.competenciesRequired,
            checkpointStatus: saved.checkpointStatus,
            startedAt: toIsoOrNull(saved.startedAt) ?? new Date().toISOString(),
            completedAt: toIsoOrNull(saved.completedAt),
        };
    }
    async getCompetencyProfile(userId) {
        const progressEntries = (await competencyProgress_model_1.CompetencyProgressModel.find({ userId })).map(mapProgress);
        const profile = {
            userId,
            listening: 0,
            speaking: 0,
            pronunciation: 0,
            vocabulary: 0,
            interaction: 0,
            fluency: 0,
            retention: 0,
            thinkingInEnglish: 0,
            updatedAt: new Date().toISOString(),
        };
        const buckets = new Map();
        for (const progress of progressEntries) {
            const competency = this.getCompetency(progress.competencyId);
            if (!competency) {
                continue;
            }
            const key = categoryKey(competency.category);
            buckets.set(key, [...(buckets.get(key) ?? []), progress.masteryScore]);
            buckets.set("retention", [...(buckets.get("retention") ?? []), progress.retentionScore]);
        }
        for (const [key, values] of buckets) {
            if (key in profile && values.length > 0) {
                profile[key] = clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
            }
        }
        return profile;
    }
    async getUserRoadmap(userId) {
        const levelProgress = await this.getUserLevelProgress(userId);
        const progressEntries = (await competencyProgress_model_1.CompetencyProgressModel.find({ userId })).map(mapProgress);
        const progressByCompetency = new Map(progressEntries.map((entry) => [entry.competencyId, entry]));
        const currentLevel = levelProgress?.currentLevel ?? "A1.1";
        const currentIndex = learningRoadmap_1.cefrSequence.indexOf(currentLevel);
        return {
            currentLevel,
            targetLevel: levelProgress?.targetLevel ?? "B2.2",
            levels: learningRoadmap_1.cefrLevels.map((level) => {
                const levelIndex = learningRoadmap_1.cefrSequence.indexOf(level.code);
                const levelCompetencies = learningRoadmap_1.competencies.filter((competency) => competency.level === level.code);
                const mastered = levelCompetencies.filter((competency) => progressByCompetency.get(competency.id)?.status === "mastered").length;
                return {
                    ...level,
                    status: levelIndex < currentIndex
                        ? "completed"
                        : levelIndex === currentIndex
                            ? "current"
                            : "locked",
                    progress: levelCompetencies.length
                        ? clampScore((mastered / levelCompetencies.length) * 100)
                        : 0,
                    competenciesMastered: mastered,
                    competenciesTotal: levelCompetencies.length,
                };
            }),
        };
    }
    async getDailyLearningContext(userId) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) {
            return null;
        }
        const currentLevel = normalizeCEFRLevel(user.currentLevel);
        const unit = learningRoadmap_1.learningUnits.find((entry) => entry.level === currentLevel && entry.status === "published") ??
            learningRoadmap_1.learningUnits.find((entry) => entry.status === "published");
        if (!unit) {
            return null;
        }
        const date = todayKey();
        const dailyPlan = await dailyPlan_model_1.DailyPlanModel.findOne({ userId, date });
        const completedMinutes = dailyPlan?.blocks
            ?.filter((block) => block.status === "completed")
            .reduce((sum, block) => sum + Number(block.durationMinutes ?? 0), 0) ?? 0;
        const exercises = [
            { type: "listening", ids: unit.listeningContentIds },
            { type: "shadowing", ids: unit.pronunciationContentIds },
            { type: "speaking-coach", ids: unit.pronunciationContentIds },
            { type: "vocabulary", ids: unit.reviewContentIds },
            { type: "conversation", ids: unit.speakingContentIds },
            { type: "review", ids: unit.reviewContentIds },
        ].map((entry, index) => ({
            id: `${date}-${unit.id}-${entry.type}`,
            type: entry.type,
            title: entry.type,
            estimatedMinutes: Math.max(4, Math.round(unit.estimatedMinutes / 6)),
            competencyIds: unit.competencies,
            contentIds: entry.ids,
            order: index + 1,
        }));
        return {
            userId,
            date,
            learningUnitId: unit.id,
            targetCompetencies: unit.competencies,
            targetChunks: unit.vocabularyChunks,
            scenario: unit.scenario,
            exercises,
            totalEstimatedMinutes: unit.estimatedMinutes,
            completedMinutes,
            completionPercentage: clampScore((completedMinutes / unit.estimatedMinutes) * 100),
        };
    }
    async recordEvidence(input) {
        const competency = this.getCompetency(input.competencyId);
        if (!competency) {
            return null;
        }
        const score = clampScore(input.evidence.score);
        const now = new Date(input.evidence.createdAt ?? Date.now());
        const existing = await competencyProgress_model_1.CompetencyProgressModel.findOne({
            userId: input.userId,
            competencyId: competency.id,
        });
        const previousMastery = existing?.masteryScore ?? 0;
        const previousRetention = existing?.retentionScore ?? 0;
        const attempts = (existing?.attempts ?? 0) + 1;
        const successfulAttempts = (existing?.successfulAttempts ?? 0) + (score >= competency.requiredScore ? 1 : 0);
        const masteryScore = clampScore(previousMastery === 0 ? score : previousMastery * 0.68 + score * 0.32);
        const retentionWeight = input.evidence.type === "retention_review" ? 0.5 : 0.18;
        const retentionScore = clampScore(previousRetention === 0 ? score : previousRetention * (1 - retentionWeight) + score * retentionWeight);
        const confidenceScore = clampScore((masteryScore + retentionScore) / 2);
        const mastered = attempts >= competency.requiredAttempts &&
            masteryScore >= competency.requiredScore &&
            retentionScore >= competency.requiredRetentionScore &&
            successfulAttempts >= 2;
        const status = mastered ? "mastered" : score < competency.requiredScore ? "reviewing" : "learning";
        const saved = await competencyProgress_model_1.CompetencyProgressModel.findOneAndUpdate({ userId: input.userId, competencyId: competency.id }, {
            $set: {
                masteryScore,
                retentionScore,
                confidenceScore,
                attempts,
                successfulAttempts,
                lastPracticedAt: now,
                lastAssessedAt: now,
                masteredAt: mastered ? existing?.masteredAt ?? now : null,
                status,
            },
            $push: {
                evidence: {
                    ...input.evidence,
                    score,
                    createdAt: now,
                    metadata: input.evidence.metadata ?? {},
                },
            },
        }, { new: true, upsert: true });
        await this.getUserLevelProgress(input.userId);
        return mapProgress(saved);
    }
    async recordLearningAttempt(input) {
        const competencyIds = Array.isArray(input.competencyIds) ? input.competencyIds : [];
        if (!input.type || competencyIds.length === 0) {
            return { status: 400, body: { message: "type and competencyIds are required" } };
        }
        const saved = await Promise.all(competencyIds.map((competencyId) => this.recordEvidence({
            userId: input.userId,
            competencyId,
            evidence: {
                type: input.type,
                score: clampScore(input.score ?? 0),
                sourceId: input.sourceId,
                metadata: input.metadata ?? {},
            },
        })));
        return {
            status: 201,
            body: {
                updated: saved.filter(Boolean),
            },
        };
    }
    async recordListeningAttemptEvidence(input) {
        const competencyIds = Array.isArray(input.competencyIds) ? input.competencyIds : [];
        if (competencyIds.length === 0) {
            return [];
        }
        const score = calculateListeningScore(input);
        return Promise.all(competencyIds.map((competencyId) => this.recordEvidence({
            userId: input.userId,
            competencyId,
            evidence: {
                type: "listening_attempt",
                score,
                sourceId: input.exerciseId,
                metadata: {
                    comprehensionCorrect: Boolean(input.comprehensionCorrect),
                    translationOpened: Boolean(input.translationOpened),
                    transcriptOpened: Boolean(input.transcriptOpened),
                    slowAudioUsed: Boolean(input.slowAudioUsed),
                    replayCount: Math.max(0, Number(input.replayCount ?? 0)),
                    unknownWords: input.unknownWords ?? [],
                },
            },
        })));
    }
    async startDiagnostic(userId, declaredLevel) {
        const attempt = await diagnosticAttempt_model_1.DiagnosticAttemptModel.create({
            userId,
            declaredLevel: declaredLevel ? normalizeCEFRLevel(declaredLevel) : undefined,
            status: "in_progress",
        });
        return { id: String(attempt._id), status: attempt.status };
    }
    async submitDiagnostic(userId, attemptId, evidence) {
        const scores = evidence.map((entry) => clampScore(entry.score));
        const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
        const diagnosedLevel = average >= 78 ? "B1.1" : average >= 68 ? "A2.2" : average >= 58 ? "A2.1" : average >= 45 ? "A1.2" : "A1.1";
        const attempt = await diagnosticAttempt_model_1.DiagnosticAttemptModel.findOneAndUpdate({ _id: attemptId, userId }, {
            $push: {
                evidence: {
                    $each: evidence.map((entry) => ({
                        type: entry.type,
                        score: clampScore(entry.score),
                        payload: entry.payload ?? {},
                    })),
                },
            },
            $set: {
                diagnosedLevel,
                confidence: clampScore(average),
            },
        }, { new: true });
        return attempt ? { id: String(attempt._id), diagnosedLevel, confidence: attempt.confidence } : null;
    }
    async finishDiagnostic(userId, attemptId, selectedLevel) {
        const attempt = await diagnosticAttempt_model_1.DiagnosticAttemptModel.findOne({ _id: attemptId, userId });
        if (!attempt) {
            return null;
        }
        const finalLevel = normalizeCEFRLevel(selectedLevel || attempt.diagnosedLevel || attempt.declaredLevel || undefined);
        await diagnosticAttempt_model_1.DiagnosticAttemptModel.findByIdAndUpdate(attemptId, {
            $set: {
                selectedLevel: finalLevel,
                status: "completed",
            },
        });
        await user_model_1.UserModel.findByIdAndUpdate(userId, { $set: { currentLevel: finalLevel } });
        await this.getUserLevelProgress(userId);
        return { selectedLevel: finalLevel, status: "completed" };
    }
    async startCheckpoint(userId, checkpointId) {
        const checkpoint = learningRoadmap_1.checkpoints.find((entry) => entry.id === checkpointId);
        if (!checkpoint) {
            return null;
        }
        await this.getUserLevelProgress(userId);
        await userLevelProgress_model_1.UserLevelProgressModel.findOneAndUpdate({ userId }, { $set: { checkpointStatus: "in_progress" } }, { new: true, upsert: true });
        return { checkpoint, status: "in_progress" };
    }
    async submitCheckpoint(userId, checkpointId, scores) {
        const checkpoint = learningRoadmap_1.checkpoints.find((entry) => entry.id === checkpointId);
        if (!checkpoint) {
            return null;
        }
        const values = Object.values(scores).map(clampScore);
        const checkpointScore = values.length ? clampScore(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
        await Promise.all(checkpoint.requiredCompetencies.map((competencyId) => this.recordEvidence({
            userId,
            competencyId,
            evidence: {
                type: "checkpoint",
                score: checkpointScore,
                sourceId: checkpoint.id,
                metadata: { scores },
            },
        })));
        return { checkpointScore, scores };
    }
    async finishCheckpoint(userId, checkpointId, scores) {
        const checkpoint = learningRoadmap_1.checkpoints.find((entry) => entry.id === checkpointId);
        if (!checkpoint) {
            return null;
        }
        const submitted = await this.submitCheckpoint(userId, checkpointId, scores);
        const profile = await this.getCompetencyProfile(userId);
        const progress = await this.getUserLevelProgress(userId);
        const minimums = checkpoint.minimumScores;
        const passed = Boolean(progress) &&
            progress.competenciesRequired > 0 &&
            progress.competenciesMastered / progress.competenciesRequired >= 0.8 &&
            profile.listening >= minimums.listening &&
            profile.speaking >= minimums.speaking &&
            profile.vocabulary >= minimums.vocabulary &&
            profile.retention >= minimums.retention &&
            (submitted?.checkpointScore ?? 0) >= minimums.checkpoint;
        if (passed && progress) {
            const nextLevel = getNextLevel(progress.currentLevel);
            await user_model_1.UserModel.findByIdAndUpdate(userId, { $set: { currentLevel: nextLevel } });
            await userLevelProgress_model_1.UserLevelProgressModel.findOneAndUpdate({ userId }, {
                $set: {
                    checkpointStatus: "passed",
                    completedAt: new Date(),
                    currentLevel: nextLevel,
                },
            }, { new: true, upsert: true });
        }
        else {
            await userLevelProgress_model_1.UserLevelProgressModel.findOneAndUpdate({ userId }, { $set: { checkpointStatus: "failed" } }, { new: true, upsert: true });
        }
        return {
            passed,
            checkpointScore: submitted?.checkpointScore ?? 0,
            profile,
            nextLevel: passed && progress ? getNextLevel(progress.currentLevel) : progress?.currentLevel,
        };
    }
}
exports.LearningService = LearningService;
