"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentRepository = void 0;
const mockData_1 = require("../data/mockData");
class ContentRepository {
    async getDashboardContent() {
        return mockData_1.dashboardMock;
    }
    async updateVocabularyReview(itemId, review) {
        const item = mockData_1.dashboardMock.vocabulary.find((entry) => entry.id === itemId);
        if (!item) {
            return null;
        }
        Object.assign(item, review);
        return item;
    }
}
exports.ContentRepository = ContentRepository;
