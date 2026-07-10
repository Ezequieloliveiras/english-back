import { ListeningAttemptModel } from "../models/listeningAttempt.model";
import { PracticeActivityModel } from "../models/practiceActivity.model";

export class PracticeRepository {
  async completeActivity(input: {
    userId: string;
    type: string;
    itemId: string;
    title: string;
  }) {
    return PracticeActivityModel.findOneAndUpdate(
      { userId: input.userId, type: input.type, itemId: input.itemId },
      {
        $set: {
          title: input.title,
          status: "completed",
          completedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );
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
    return ListeningAttemptModel.create({
      ...input,
      completedAt: new Date(),
    });
  }
}
