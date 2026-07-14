"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticeService = void 0;
const activityTypeToDailyPlanEvidence = (type) => {
    const normalized = type.trim().toLowerCase();
    if (normalized === "listening") {
        return { blockType: "listening", evidenceType: "listening_completion" };
    }
    if (normalized === "shadowing" || normalized === "repetition") {
        return { blockType: "shadowing", evidenceType: "practice_completion" };
    }
    if (normalized === "speaking-coach" || normalized === "speaking_coach" || normalized === "pronunciation") {
        return { blockType: "speaking-coach", evidenceType: "practice_completion" };
    }
    if (normalized === "conversation" || normalized === "think-in-english" || normalized === "developer-mode") {
        return { blockType: "conversation", evidenceType: "practice_completion" };
    }
    if (normalized === "vocabulary") {
        return { blockType: "vocabulary", evidenceType: "practice_completion" };
    }
    if (normalized === "review") {
        return { blockType: "review", evidenceType: "practice_completion" };
    }
    return null;
};
class PracticeService {
    constructor(practiceRepository, dailyPlanService, progressService) {
        this.practiceRepository = practiceRepository;
        this.dailyPlanService = dailyPlanService;
        this.progressService = progressService;
    }
    async completeActivity(input) {
        if (!input.type || !input.itemId || !input.title) {
            return { status: 400, body: { message: "type, itemId and title are required" } };
        }
        const completion = await this.practiceRepository.completeActivity({
            userId: input.userId,
            type: input.type,
            itemId: input.itemId,
            title: input.title,
        });
        const activity = completion.activity;
        const evidence = activityTypeToDailyPlanEvidence(input.type);
        if (completion.created && evidence) {
            await this.dailyPlanService?.recordBlockEvidence({
                userId: input.userId,
                blockType: evidence.blockType,
                evidenceType: evidence.evidenceType,
                evidenceRef: input.itemId,
            });
        }
        return {
            status: 200,
            body: {
                id: String(activity._id),
                type: activity.type,
                itemId: activity.itemId,
                title: activity.title,
                status: activity.status,
                completedAt: activity.completedAt,
                alreadyCompleted: !completion.created,
            },
        };
    }
    async saveListeningAttempt(input) {
        if (!input.exerciseId || !input.expectedText) {
            return { status: 400, body: { message: "exerciseId and expectedText are required" } };
        }
        const saved = await this.practiceRepository.saveListeningAttempt({
            userId: input.userId,
            exerciseId: input.exerciseId,
            expectedText: input.expectedText,
            selectedMeaning: input.selectedMeaning,
            comprehensionCorrect: Boolean(input.comprehensionCorrect),
            translationOpened: Boolean(input.translationOpened),
            transcriptOpened: Boolean(input.transcriptOpened),
            slowAudioUsed: Boolean(input.slowAudioUsed),
            replayCount: Math.max(0, Number(input.replayCount ?? 0)),
            unknownWords: Array.isArray(input.unknownWords) ? input.unknownWords : [],
        });
        const attempt = saved.attempt;
        if (saved.created) {
            const planResult = await this.dailyPlanService?.recordBlockEvidence({
                userId: input.userId,
                blockType: "listening",
                evidenceType: "listening_attempt",
                evidenceRef: input.exerciseId,
            });
            await this.progressService?.recordListeningAttempt({
                userId: input.userId,
                attemptId: String(attempt._id),
                exerciseId: input.exerciseId,
                level: planResult?.user.currentLevel ?? "A1",
            });
        }
        return {
            status: saved.created ? 201 : 200,
            body: {
                id: String(attempt._id),
                exerciseId: attempt.exerciseId,
                expectedText: attempt.expectedText,
                comprehensionCorrect: attempt.comprehensionCorrect,
                completedAt: attempt.completedAt,
                alreadyCompleted: !saved.created,
            },
        };
    }
}
exports.PracticeService = PracticeService;
