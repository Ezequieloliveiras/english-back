"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
class ConversationService {
    constructor(openAiService, dailyPlanService) {
        this.openAiService = openAiService;
        this.dailyPlanService = dailyPlanService;
    }
    async reply(userId, modeId, message) {
        if (!this.openAiService) {
            throw new Error("AI service is not configured");
        }
        const aiReply = await this.openAiService.generateConversationReply({
            userId,
            mode: modeId,
            message,
            level: "A1",
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
        };
    }
}
exports.ConversationService = ConversationService;
