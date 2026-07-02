"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewController = void 0;
class ReviewController {
    constructor(reviewService) {
        this.reviewService = reviewService;
        this.record = async (request, response) => {
            const { itemId, wasCorrect } = request.body;
            if (!itemId || typeof wasCorrect !== "boolean") {
                response.status(400).json({ message: "itemId and wasCorrect are required" });
                return;
            }
            const updated = await this.reviewService.recordReview(itemId, wasCorrect);
            if (!updated) {
                response.status(404).json({ message: "Vocabulary item not found" });
                return;
            }
            response.json(updated);
        };
    }
}
exports.ReviewController = ReviewController;
