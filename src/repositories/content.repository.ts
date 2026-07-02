import { dashboardMock } from "../data/mockData";
import { DashboardPayload, VocabularyItem } from "../types";

export class ContentRepository {
  async getDashboardContent(): Promise<DashboardPayload> {
    return dashboardMock;
  }

  async updateVocabularyReview(itemId: string, review: Partial<VocabularyItem>) {
    const item = dashboardMock.vocabulary.find((entry) => entry.id === itemId);

    if (!item) {
      return null;
    }

    Object.assign(item, review);
    return item;
  }
}
