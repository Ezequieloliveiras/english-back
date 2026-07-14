"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
class ConversationService {
    constructor(openAiService, dailyPlanService) {
        this.openAiService = openAiService;
        this.dailyPlanService = dailyPlanService;
    }
    async reply(userId, modeId, message, conversationSessionId) {
        if (!this.openAiService) {
            throw new Error("AI service is not configured");
        }
        const aiReply = await this.openAiService.generateConversationReply({
            userId,
            mode: modeId,
            message,
            level: "A1",
            conversationSessionId,
        });
        await this.dailyPlanService?.recordBlockEvidence({
            userId,
            blockType: "conversation",
            evidenceType: "conversation_task",
            evidenceRef: modeId,
        });
        return {
            role: "assistant",
            content: aiReply.reply,
            correction: aiReply.correction,
            sessionId: aiReply.sessionId,
        };
    }
}
exports.ConversationService = ConversationService;
