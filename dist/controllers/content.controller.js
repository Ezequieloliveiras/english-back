"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentController = void 0;
class ContentController {
    constructor(contentService) {
        this.contentService = contentService;
        this.getBootstrap = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const payload = await this.contentService.getBootstrap(request.auth.userId);
            response.json(payload);
        };
    }
}
exports.ContentController = ContentController;
