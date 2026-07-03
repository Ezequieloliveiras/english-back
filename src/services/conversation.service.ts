import { ConversationMessage } from "../types";
import { OpenAiService } from "./openai.service";

export class ConversationService {
  constructor(private readonly openAiService?: OpenAiService) {}

  async reply(userId: string, modeId: string, message: string): Promise<ConversationMessage> {
    if (!this.openAiService) {
      throw new Error("AI service is not configured");
    }

    const aiReply = await this.openAiService.generateConversationReply({
      userId,
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
}
