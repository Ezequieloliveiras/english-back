"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
class ContentService {
    constructor(contentRepository) {
        this.contentRepository = contentRepository;
    }
    async getBootstrap() {
        return this.contentRepository.getDashboardContent();
    }
}
exports.ContentService = ContentService;
