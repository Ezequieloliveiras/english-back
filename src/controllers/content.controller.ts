import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ContentService } from "../services/content.service";

export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  getBootstrap = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const payload = await this.contentService.getBootstrap(request.auth.userId);
    response.json(payload);
  };
}
