import { ConversationMessage } from "../types";
import { DailyPlanService } from "./dailyPlan.service";
import { OpenAiService } from "./openai.service";

export class ConversationService {
  constructor(
    private readonly openAiService?: OpenAiService,
    private readonly dailyPlanService?: DailyPlanService
  ) {}

  async reply(userId: string, modeId: string, message: string, conversationSessionId?: string): Promise<ConversationMessage & { sessionId?: string }> {
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
