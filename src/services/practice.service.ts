import { PracticeRepository } from "../repositories/practice.repository";
import { StudyBlockType } from "../types";
import { DailyPlanService } from "./dailyPlan.service";
import { ProgressService } from "./progress.service";

const activityTypeToDailyPlanEvidence = (type: string): {
  blockType: StudyBlockType;
  evidenceType: string;
} | null => {
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

export class PracticeService {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly dailyPlanService?: DailyPlanService,
    private readonly progressService?: ProgressService
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
  }) {
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
