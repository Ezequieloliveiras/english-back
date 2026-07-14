import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ConversationService } from "../services/conversation.service";

export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  reply = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const { modeId, message, conversationSessionId } = request.body as {
      modeId?: string;
      message?: string;
      conversationSessionId?: string;
    };

    if (!modeId || !message) {
      response.status(400).json({ message: "modeId and message are required" });
      return;
    }

    const reply = await this.conversationService.reply(request.auth.userId, modeId, message, conversationSessionId);
    response.json(reply);
  };
}
