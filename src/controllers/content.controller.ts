import { Request, Response } from "express";
import { ContentService } from "../services/content.service";

export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  getBootstrap = async (_request: Request, response: Response) => {
    const payload = await this.contentService.getBootstrap();
    response.json(payload);
  };
}
