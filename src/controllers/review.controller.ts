import { Request, Response } from "express";
import { ReviewService } from "../services/review.service";

export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  record = async (request: Request, response: Response) => {
    const { itemId, wasCorrect } = request.body as {
      itemId?: string;
      wasCorrect?: boolean;
    };

    if (!itemId || typeof wasCorrect !== "boolean") {
      response.status(400).json({ message: "itemId and wasCorrect are required" });
      return;
    }

    const updated = await this.reviewService.recordReview(itemId, wasCorrect);

    if (!updated) {
      response.status(404).json({ message: "Vocabulary item not found" });
      return;
    }

    response.json(updated);
  };
}
