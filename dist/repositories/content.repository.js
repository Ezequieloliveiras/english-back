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
    source: item.source ?? "user_saved",
    timesPracticed: item.timesPracticed ?? item.hits + item.misses,
    timesCorrect: item.timesCorrect ?? item.hits,
    timesWrong: item.timesWrong ?? item.misses,
});
const hydrateListeningLessons = (lessons = []) => {
    const seedById = new Map(seedData_1.dashboardSeed.listeningLessons.map((lesson) => [lesson.id, lesson]));
    return lessons.map((lesson) => {
        const seedLesson = seedById.get(lesson.id);
        if (!seedLesson) {
            return lesson;
        }
        return {
            ...seedLesson,
            ...lesson,
            imageUrl: lesson.imageUrl ?? seedLesson.imageUrl,
            imageSource: lesson.imageSource ?? seedLesson.imageSource,
            imageAlt: lesson.imageAlt ?? seedLesson.imageAlt,
            situationDescription: lesson.situationDescription ?? seedLesson.situationDescription,
            comprehension: lesson.comprehension?.length ? lesson.comprehension : seedLesson.comprehension,
        };
    });
};
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
    async getLearningContent(userId) {
        await this.seedCatalogIfNeeded();
        const [vocabulary, catalogs] = await Promise.all([
            vocabularyItem_model_1.VocabularyItemModel.find({ userId }).sort({ createdAt: -1 }),
            contentCatalog_model_1.ContentCatalogModel.find(),
        ]);
        const byKey = new Map(catalogs.map((catalog) => [catalog.key, catalog.items]));
        return {
            vocabulary: vocabulary.map(toPlainVocabulary),
            listeningLessons: hydrateListeningLessons(byKey.get("listeningLessons") ?? seedData_1.dashboardSeed.listeningLessons),
            shadowingItems: byKey.get("shadowingItems") ?? [],
            conversationModes: byKey.get("conversationModes") ?? [],
            developerModes: byKey.get("developerModes") ?? [],
            thinkInEnglishPrompts: byKey.get("thinkInEnglishPrompts") ?? [],
        };
    }
    async getDueReviewItems(userId) {
        const now = new Date();
        const schedules = await reviewSchedule_model_1.ReviewScheduleModel.find({
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
    async updateVocabularyReview(userId, itemId, review) {
        const item = await vocabularyItem_model_1.VocabularyItemModel.findByIdAndUpdate(itemId, {
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
