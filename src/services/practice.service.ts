import { PracticeRepository } from "../repositories/practice.repository";
import { LearningService } from "./learning.service";

export class PracticeService {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly learningService?: LearningService
  ) {}

  async completeActivity(input: {
    userId: string;
    type?: string;
    itemId?: string;
    title?: string;
  }) {
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

  async saveListeningAttempt(input: {
    userId: string;
    exerciseId?: string;
    expectedText?: string;
    selectedMeaning?: string;
    comprehensionCorrect?: boolean;
    translationOpened?: boolean;
    transcriptOpened?: boolean;
    slowAudioUsed?: boolean;
    replayCount?: number;
    unknownWords?: string[];
    competencyIds?: string[];
  }) {
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

    await this.learningService?.recordListeningAttemptEvidence({
      userId: input.userId,
      exerciseId: input.exerciseId,
      competencyIds: input.competencyIds,
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
