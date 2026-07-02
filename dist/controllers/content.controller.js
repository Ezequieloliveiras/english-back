"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentController = void 0;
class ContentController {
    constructor(contentService) {
        this.contentService = contentService;
        this.getBootstrap = async (_request, response) => {
            const payload = await this.contentService.getBootstrap();
            response.json(payload);
        };
    }
}
exports.ContentController = ContentController;
