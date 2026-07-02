import { dashboardMock } from "../data/mockData";
import { ConversationMessage } from "../types";
import { OpenAiService } from "./openai.service";

const importantCorrections: Record<string, string> = {
  "i have 5 years experience": "Say: I have five years of experience.",
  "the bug is on production": "A more natural option is: The bug is happening in production.",
  "i maked the deploy": "Try: I deployed the update.",
};

export class ConversationService {
  constructor(private readonly openAiService?: OpenAiService) {}

  async reply(modeId: string, message: string): Promise<ConversationMessage> {
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

    const allModes = [...dashboardMock.conversationModes, ...dashboardMock.developerModes];
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
