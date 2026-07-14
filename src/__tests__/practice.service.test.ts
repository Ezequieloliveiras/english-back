import { describe, expect, it, jest } from "@jest/globals";
import { PracticeRepository } from "../repositories/practice.repository";
import { PracticeService } from "../services/practice.service";
import { DailyPlanService } from "../services/dailyPlan.service";

const buildActivity = () => ({
  _id: "activity-1",
  type: "shadowing",
  itemId: "phrase-1",
  title: "I am looking into the issue.",
  status: "completed",
  completedAt: new Date("2026-07-13T12:00:00.000Z"),
});

const buildAttempt = () => ({
  _id: "attempt-1",
  exerciseId: "line-1",
  expectedText: "I can explain my next step.",
  comprehensionCorrect: true,
  completedAt: new Date("2026-07-13T12:00:00.000Z"),
});

describe("PracticeService idempotency", () => {
  it("does not record daily-plan evidence again for an already completed activity", async () => {
    const repository = {
      completeActivity: jest.fn(async () => ({
        activity: buildActivity(),
        created: false,
      })),
    } as unknown as PracticeRepository;
    const dailyPlanService = {
      recordBlockEvidence: jest.fn(),
    } as unknown as DailyPlanService;
    const service = new PracticeService(repository, dailyPlanService);

    const result = await service.completeActivity({
      userId: "user-1",
      type: "shadowing",
      itemId: "phrase-1",
      title: "I am looking into the issue.",
    });

    expect(result.status).toBe(200);
    expect(result.body.alreadyCompleted).toBe(true);
    expect(dailyPlanService.recordBlockEvidence).not.toHaveBeenCalled();
  });

  it("records daily-plan evidence once for a new activity completion", async () => {
    const repository = {
      completeActivity: jest.fn(async () => ({
        activity: buildActivity(),
        created: true,
      })),
    } as unknown as PracticeRepository;
    const dailyPlanService = {
      recordBlockEvidence: jest.fn(),
    } as unknown as DailyPlanService;
    const service = new PracticeService(repository, dailyPlanService);

    const result = await service.completeActivity({
      userId: "user-1",
      type: "shadowing",
      itemId: "phrase-1",
      title: "I am looking into the issue.",
    });

    expect(result.status).toBe(200);
    expect(result.body.alreadyCompleted).toBe(false);
    expect(dailyPlanService.recordBlockEvidence).toHaveBeenCalledTimes(1);
  });

  it("does not record daily-plan evidence again for an existing listening attempt", async () => {
    const repository = {
      saveListeningAttempt: jest.fn(async () => ({
        attempt: buildAttempt(),
        created: false,
      })),
    } as unknown as PracticeRepository;
    const dailyPlanService = {
      recordBlockEvidence: jest.fn(),
    } as unknown as DailyPlanService;
    const service = new PracticeService(repository, dailyPlanService);

    const result = await service.saveListeningAttempt({
      userId: "user-1",
      exerciseId: "line-1",
      expectedText: "I can explain my next step.",
      comprehensionCorrect: true,
    });

    expect(result.status).toBe(200);
    expect(result.body.alreadyCompleted).toBe(true);
    expect(dailyPlanService.recordBlockEvidence).not.toHaveBeenCalled();
  });
});
