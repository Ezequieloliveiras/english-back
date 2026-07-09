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
  source: item.source ?? "user_saved",
  timesPracticed: item.timesPracticed ?? item.hits + item.misses,
  timesCorrect: item.timesCorrect ?? item.hits,
  timesWrong: item.timesWrong ?? item.misses,
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

  async getLearningContent(userId: string) {
    await this.seedCatalogIfNeeded();

    const [vocabulary, catalogs] = await Promise.all([
      VocabularyItemModel.find({ userId }).sort({ createdAt: -1 }),
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

  async getDueReviewItems(userId: string) {
    const now = new Date();
    const schedules = await ReviewScheduleModel.find({
      userId,
      nextReviewAt: { $lte: now },
    })
      .sort({ nextReviewAt: 1 })
      .populate("vocabularyItemId");

    return schedules
      .map((schedule) => schedule.vocabularyItemId)
      .filter(Boolean)
      .map(toPlainVocabulary);
  }

  async updateVocabularyReview(userId: string, itemId: string, review: Partial<VocabularyItem>) {
    const item = await VocabularyItemModel.findByIdAndUpdate(
      itemId,
      {
        $set: {
          userId,
          ...(review.confidence !== undefined ? { confidence: review.confidence } : {}),
          ...(review.nextReviewAt ? { nextReviewAt: new Date(review.nextReviewAt) } : {}),
          ...(review.hits !== undefined ? { hits: review.hits } : {}),
          ...(review.misses !== undefined ? { misses: review.misses } : {}),
          ...(review.hits !== undefined ? { timesCorrect: review.hits } : {}),
          ...(review.misses !== undefined ? { timesWrong: review.misses } : {}),
          timesPracticed: (review.hits ?? 0) + (review.misses ?? 0),
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
