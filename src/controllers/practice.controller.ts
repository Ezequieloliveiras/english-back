import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { PracticeService } from "../services/practice.service";

export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  complete = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) {
        response.status(401).json({ message: "Authentication required" });
        return;
      }

      const result = await this.practiceService.completeActivity({
        userId: request.auth.userId,
        ...request.body,
      });
      response.status(result.status).json(result.body);
    } catch {
      response.status(500).json({ message: "Could not save practice activity" });
    }
  };

  listeningAttempt = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) {
        response.status(401).json({ message: "Authentication required" });
        return;
      }

      const result = await this.practiceService.saveListeningAttempt({
        userId: request.auth.userId,
        ...request.body,
      });
      response.status(result.status).json(result.body);
    } catch {
      response.status(500).json({ message: "Could not save listening attempt" });
    }
  };
}
