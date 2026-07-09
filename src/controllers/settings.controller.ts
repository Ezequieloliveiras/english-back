import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { SettingsService } from "../services/settings.service";

export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  get = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const settings = await this.settingsService.getSettings(request.auth.userId);
    response.json({ settings });
  };

  update = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const settings = await this.settingsService.updateSettings(request.auth.userId, request.body);
    response.json({ settings });
  };
}
