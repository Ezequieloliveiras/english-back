"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationController = void 0;
class ConversationController {
    constructor(conversationService) {
        this.conversationService = conversationService;
        this.reply = async (request, response) => {
            const { modeId, message } = request.body;
            if (!modeId || !message) {
                response.status(400).json({ message: "modeId and message are required" });
                return;
            }
            const reply = await this.conversationService.reply(modeId, message);
            response.json(reply);
        };
    }
}
exports.ConversationController = ConversationController;
