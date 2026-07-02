import { Request, Response } from "express";
import { ConversationService } from "../services/conversation.service";

export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  reply = async (request: Request, response: Response) => {
    const { modeId, message } = request.body as { modeId?: string; message?: string };

    if (!modeId || !message) {
      response.status(400).json({ message: "modeId and message are required" });
      return;
    }

    const reply = await this.conversationService.reply(modeId, message);
    response.json(reply);
  };
}
