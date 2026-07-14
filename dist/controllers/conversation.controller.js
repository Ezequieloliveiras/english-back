"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationController = void 0;
class ConversationController {
    constructor(conversationService) {
        this.conversationService = conversationService;
        this.reply = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const { modeId, message, conversationSessionId } = request.body;
            if (!modeId || !message) {
                response.status(400).json({ message: "modeId and message are required" });
                return;
            }
            const reply = await this.conversationService.reply(request.auth.userId, modeId, message, conversationSessionId);
            response.json(reply);
        };
    }
}
exports.ConversationController = ConversationController;
