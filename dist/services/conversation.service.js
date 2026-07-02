"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const mockData_1 = require("../data/mockData");
const importantCorrections = {
    "i have 5 years experience": "Say: I have five years of experience.",
    "the bug is on production": "A more natural option is: The bug is happening in production.",
    "i maked the deploy": "Try: I deployed the update.",
};
class ConversationService {
    constructor(openAiService) {
        this.openAiService = openAiService;
    }
    async reply(modeId, message) {
        if (this.openAiService) {
            const aiReply = await this.openAiService.generateConversationReply({
                userId: "user-demo",
                mode: modeId,
                message,
                level: "A1",
            });
            return {
                role: "assistant",
                content: aiReply.reply,
                correction: aiReply.correction,
            };
        }
        const allModes = [...mockData_1.dashboardMock.conversationModes, ...mockData_1.dashboardMock.developerModes];
        const mode = allModes.find((entry) => entry.id === modeId);
        const normalized = message.trim().toLowerCase();
        const correction = importantCorrections[normalized];
        return {
            role: "assistant",
            content: mode
                ? `Good direction. Keep going in simple English about "${mode.title}". Tell me one concrete example from your real life or work.`
                : "Good. Keep speaking in short sentences. Give me one specific example and one next step.",
            correction,
        };
    }
}
exports.ConversationService = ConversationService;
