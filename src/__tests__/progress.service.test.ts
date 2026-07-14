import { describe, expect, it, jest } from "@jest/globals";
import { ProgressRepository } from "../repositories/progress.repository";
import { ProgressService } from "../services/progress.service";

describe("ProgressService", () => {
  it("records a listening attempt once and recalculates skill scores", async () => {
    const repository = {
      recordEvent: jest.fn(async () => ({ created: true })),
      incrementAccumulatedStats: jest.fn(async () => ({})),
      recalculateSkillScores: jest.fn(async () => ({ listeningScore: 82 })),
    } as unknown as ProgressRepository;
    const service = new ProgressService(repository);

    const result = await service.recordListeningAttempt({
      userId: "user-1",
      attemptId: "attempt-1",
      exerciseId: "line-1",
      level: "A2",
    });

    expect(repository.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: "listening-attempt:attempt-1:stats",
    }));
    expect(repository.incrementAccumulatedStats).toHaveBeenCalledWith("user-1", { minutes: 1 });
    expect(repository.recalculateSkillScores).toHaveBeenCalledWith("user-1", "A2");
    expect(result).toEqual({ listeningScore: 82 });
  });

  it("does not increment accumulated stats twice for the same listening attempt", async () => {
    const repository = {
      recordEvent: jest.fn(async () => ({ created: false })),
      incrementAccumulatedStats: jest.fn(async () => ({})),
      recalculateSkillScores: jest.fn(async () => ({ listeningScore: 82 })),
    } as unknown as ProgressRepository;
    const service = new ProgressService(repository);

    await service.recordListeningAttempt({
      userId: "user-1",
      attemptId: "attempt-1",
      exerciseId: "line-1",
      level: "A2",
    });

    expect(repository.incrementAccumulatedStats).not.toHaveBeenCalled();
    expect(repository.recalculateSkillScores).toHaveBeenCalledWith("user-1", "A2");
  });

  it("uses review count to keep vocabulary review events idempotent per review", async () => {
    const repository = {
      recordEvent: jest.fn(async () => ({ created: true })),
      incrementAccumulatedStats: jest.fn(async () => ({})),
      recalculateSkillScores: jest.fn(async () => ({ vocabularyScore: 74 })),
    } as unknown as ProgressRepository;
    const service = new ProgressService(repository);

    await service.recordVocabularyReview({
      userId: "user-1",
      itemId: "vocab-1",
      level: "B1",
      wasCorrect: true,
      reviewCount: 3,
    });

    expect(repository.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: "vocabulary-review:vocab-1:3",
    }));
  });
});
