import { dashboardSeed } from "../data/seedData";
import { ContentCatalogModel } from "../models/contentCatalog.model";
import { ReviewScheduleModel } from "../models/reviewSchedule.model";
import { VocabularyItemModel } from "../models/vocabularyItem.model";
import { DashboardPayload, VocabularyItem } from "../types";

const toPlainVocabulary = (item: any): VocabularyItem => ({
  id: String(item._id ?? item.id),
  phrase: item.phrase,
  translation: item.translation,
  level: item.level,
  category: item.category,
  sentences: item.sentences,
  confidence: item.confidence,
  nextReviewAt: item.nextReviewAt instanceof Date ? item.nextReviewAt.toISOString() : item.nextReviewAt,
  hits: item.hits,
  misses: item.misses,
});

export class ContentRepository {
  private async seedCatalogIfNeeded() {
    const [vocabularyCount, catalogCount] = await Promise.all([
      VocabularyItemModel.countDocuments(),
      ContentCatalogModel.countDocuments(),
    ]);

    if (vocabularyCount === 0) {
      await VocabularyItemModel.insertMany(
        dashboardSeed.vocabulary.map((item) => ({
          phrase: item.phrase,
          translation: item.translation,
          level: item.level,
          category: item.category,
          sentences: item.sentences,
          confidence: item.confidence,
          nextReviewAt: new Date(item.nextReviewAt),
          hits: item.hits,
          misses: item.misses,
        }))
      );
    }

    if (catalogCount === 0) {
      await ContentCatalogModel.insertMany([
        { key: "listeningLessons", items: dashboardSeed.listeningLessons },
        { key: "shadowingItems", items: dashboardSeed.shadowingItems },
        { key: "conversationModes", items: dashboardSeed.conversationModes },
        { key: "developerModes", items: dashboardSeed.developerModes },
        { key: "thinkInEnglishPrompts", items: dashboardSeed.thinkInEnglishPrompts },
      ]);
    }
  }

  async getLearningContent() {
    await this.seedCatalogIfNeeded();

    const [vocabulary, catalogs] = await Promise.all([
      VocabularyItemModel.find().sort({ createdAt: 1 }),
      ContentCatalogModel.find(),
    ]);
    const byKey = new Map(catalogs.map((catalog) => [catalog.key, catalog.items]));

    return {
      vocabulary: vocabulary.map(toPlainVocabulary),
      listeningLessons: byKey.get("listeningLessons") ?? [],
      shadowingItems: byKey.get("shadowingItems") ?? [],
      conversationModes: byKey.get("conversationModes") ?? [],
      developerModes: byKey.get("developerModes") ?? [],
      thinkInEnglishPrompts: byKey.get("thinkInEnglishPrompts") ?? [],
    };
  }

  async updateVocabularyReview(userId: string, itemId: string, review: Partial<VocabularyItem>) {
    const item = await VocabularyItemModel.findByIdAndUpdate(
      itemId,
      {
        $set: {
          ...(review.confidence !== undefined ? { confidence: review.confidence } : {}),
          ...(review.nextReviewAt ? { nextReviewAt: new Date(review.nextReviewAt) } : {}),
          ...(review.hits !== undefined ? { hits: review.hits } : {}),
          ...(review.misses !== undefined ? { misses: review.misses } : {}),
        },
      },
      { new: true }
    );

    if (!item) {
      return null;
    }

    await ReviewScheduleModel.findOneAndUpdate(
      { userId, vocabularyItemId: item._id },
      {
        $set: {
          hits: item.hits,
          misses: item.misses,
          confidence: item.confidence,
          nextReviewAt: item.nextReviewAt,
        },
      },
      { new: true, upsert: true }
    );

    return toPlainVocabulary(item);
  }
}
