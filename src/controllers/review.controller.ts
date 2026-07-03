import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ReviewService } from "../services/review.service";

export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  record = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const { itemId, wasCorrect } = request.body as {
      itemId?: string;
      wasCorrect?: boolean;
    };

    if (!itemId || typeof wasCorrect !== "boolean") {
      response.status(400).json({ message: "itemId and wasCorrect are required" });
      return;
    }

    const updated = await this.reviewService.recordReview(request.auth.userId, itemId, wasCorrect);

    if (!updated) {
      response.status(404).json({ message: "Vocabulary item not found" });
      return;
    }

    response.json(updated);
  };
}
