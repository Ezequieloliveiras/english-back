"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticeService = void 0;
class PracticeService {
    constructor(practiceRepository) {
        this.practiceRepository = practiceRepository;
    }
    async completeActivity(input) {
        if (!input.type || !input.itemId || !input.title) {
            return { status: 400, body: { message: "type, itemId and title are required" } };
        }
        const activity = await this.practiceRepository.completeActivity({
            userId: input.userId,
            type: input.type,
            itemId: input.itemId,
            title: input.title,
        });
        return {
            status: 200,
            body: {
                id: String(activity._id),
                type: activity.type,
                itemId: activity.itemId,
                title: activity.title,
                status: activity.status,
                completedAt: activity.completedAt,
            },
        };
    }
    async saveListeningAttempt(input) {
        if (!input.exerciseId || !input.expectedText) {
            return { status: 400, body: { message: "exerciseId and expectedText are required" } };
        }
        const attempt = await this.practiceRepository.saveListeningAttempt({
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
        return {
            status: 201,
            body: {
                id: String(attempt._id),
                exerciseId: attempt.exerciseId,
                expectedText: attempt.expectedText,
                comprehensionCorrect: attempt.comprehensionCorrect,
                completedAt: attempt.completedAt,
            },
        };
    }
}
exports.PracticeService = PracticeService;
