import { ListeningAttemptModel } from "../models/listeningAttempt.model";
import { PracticeActivityModel } from "../models/practiceActivity.model";

const toPlainId = (value: unknown) => String(value ?? "");

export class PracticeRepository {
  async getUserCompletionState(userId: string) {
    const [activities, listeningAttempts] = await Promise.all([
      PracticeActivityModel.find({ userId, status: "completed" }).select("type itemId title completedAt"),
      ListeningAttemptModel.find({ userId }).select("exerciseId completedAt"),
    ]);

    return {
      completedActivities: activities.map((activity) => ({
        id: toPlainId(activity._id),
        type: activity.type,
        itemId: activity.itemId,
        title: activity.title,
        completedAt: activity.completedAt?.toISOString?.() ?? String(activity.completedAt),
      })),
      listeningAttempts: listeningAttempts.map((attempt) => ({
        id: toPlainId(attempt._id),
        exerciseId: attempt.exerciseId,
        completedAt: attempt.completedAt?.toISOString?.() ?? String(attempt.completedAt),
      })),
    };
  }

  async completeActivity(input: {
    userId: string;
    type: string;
    itemId: string;
    title: string;
  }) {
    const query = { userId: input.userId, type: input.type, itemId: input.itemId };
    const existing = await PracticeActivityModel.findOne(query);

    if (existing) {
      return { activity: existing, created: false };
    }

    try {
      const activity = await PracticeActivityModel.create({
        ...input,
        status: "completed",
        completedAt: new Date(),
      });

      return { activity, created: true };
    } catch (error: any) {
      if (error?.code === 11000) {
        const activity = await PracticeActivityModel.findOne(query);

        if (activity) {
          return { activity, created: false };
        }
      }

      throw error;
    }
  }

  async saveListeningAttempt(input: {
    userId: string;
    exerciseId: string;
    expectedText: string;
    selectedMeaning?: string;
    comprehensionCorrect: boolean;
    translationOpened: boolean;
    transcriptOpened: boolean;
    slowAudioUsed: boolean;
    replayCount: number;
    unknownWords: string[];
  }) {
    const query = { userId: input.userId, exerciseId: input.exerciseId };
    const existing = await ListeningAttemptModel.findOne(query);

    if (existing) {
      return { attempt: existing, created: false };
    }

    try {
      const attempt = await ListeningAttemptModel.create({
        ...input,
        completedAt: new Date(),
      });

      return { attempt, created: true };
    } catch (error: any) {
      if (error?.code === 11000) {
        const attempt = await ListeningAttemptModel.findOne(query);

        if (attempt) {
          return { attempt, created: false };
        }
      }

      throw error;
    }
  }
}
