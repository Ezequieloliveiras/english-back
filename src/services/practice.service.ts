import { PracticeRepository } from "../repositories/practice.repository";

export class PracticeService {
  constructor(private readonly practiceRepository: PracticeRepository) {}

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
}
