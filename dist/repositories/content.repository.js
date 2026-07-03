"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentRepository = void 0;
const seedData_1 = require("../data/seedData");
const contentCatalog_model_1 = require("../models/contentCatalog.model");
const reviewSchedule_model_1 = require("../models/reviewSchedule.model");
const vocabularyItem_model_1 = require("../models/vocabularyItem.model");
const toPlainVocabulary = (item) => ({
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
class ContentRepository {
    async seedCatalogIfNeeded() {
        const [vocabularyCount, catalogCount] = await Promise.all([
            vocabularyItem_model_1.VocabularyItemModel.countDocuments(),
            contentCatalog_model_1.ContentCatalogModel.countDocuments(),
        ]);
        if (vocabularyCount === 0) {
            await vocabularyItem_model_1.VocabularyItemModel.insertMany(seedData_1.dashboardSeed.vocabulary.map((item) => ({
                phrase: item.phrase,
                translation: item.translation,
                level: item.level,
                category: item.category,
                sentences: item.sentences,
                confidence: item.confidence,
                nextReviewAt: new Date(item.nextReviewAt),
                hits: item.hits,
                misses: item.misses,
            })));
        }
        if (catalogCount === 0) {
            await contentCatalog_model_1.ContentCatalogModel.insertMany([
                { key: "listeningLessons", items: seedData_1.dashboardSeed.listeningLessons },
                { key: "shadowingItems", items: seedData_1.dashboardSeed.shadowingItems },
                { key: "conversationModes", items: seedData_1.dashboardSeed.conversationModes },
                { key: "developerModes", items: seedData_1.dashboardSeed.developerModes },
                { key: "thinkInEnglishPrompts", items: seedData_1.dashboardSeed.thinkInEnglishPrompts },
            ]);
        }
    }
    async getLearningContent() {
        await this.seedCatalogIfNeeded();
        const [vocabulary, catalogs] = await Promise.all([
            vocabularyItem_model_1.VocabularyItemModel.find().sort({ createdAt: 1 }),
            contentCatalog_model_1.ContentCatalogModel.find(),
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
    async updateVocabularyReview(userId, itemId, review) {
        const item = await vocabularyItem_model_1.VocabularyItemModel.findByIdAndUpdate(itemId, {
            $set: {
                ...(review.confidence !== undefined ? { confidence: review.confidence } : {}),
                ...(review.nextReviewAt ? { nextReviewAt: new Date(review.nextReviewAt) } : {}),
                ...(review.hits !== undefined ? { hits: review.hits } : {}),
                ...(review.misses !== undefined ? { misses: review.misses } : {}),
            },
        }, { new: true });
        if (!item) {
            return null;
        }
        await reviewSchedule_model_1.ReviewScheduleModel.findOneAndUpdate({ userId, vocabularyItemId: item._id }, {
            $set: {
                hits: item.hits,
                misses: item.misses,
                confidence: item.confidence,
                nextReviewAt: item.nextReviewAt,
            },
        }, { new: true, upsert: true });
        return toPlainVocabulary(item);
    }
}
exports.ContentRepository = ContentRepository;
