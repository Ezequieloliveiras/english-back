"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticeController = void 0;
class PracticeController {
    constructor(practiceService) {
        this.practiceService = practiceService;
        this.complete = async (request, response) => {
            try {
                if (!request.auth?.userId) {
                    response.status(401).json({ message: "Authentication required" });
                    return;
                }
                const result = await this.practiceService.completeActivity({
                    userId: request.auth.userId,
                    ...request.body,
                });
                response.status(result.status).json(result.body);
            }
            catch {
                response.status(500).json({ message: "Could not save practice activity" });
            }
        };
    }
}
exports.PracticeController = PracticeController;
