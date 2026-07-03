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
}
