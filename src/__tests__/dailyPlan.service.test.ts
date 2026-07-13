import { describe, expect, it, jest } from "@jest/globals";
import { DailyPlanRepository } from "../repositories/dailyPlan.repository";
import { DailyPlanService } from "../services/dailyPlan.service";
import { DailyPlan, ProgressSnapshot, UserProfile } from "../types";

const service = new DailyPlanService({} as DailyPlanRepository);

const buildProfile = (dailyMinutes: number): UserProfile => ({
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  currentLevel: "A1",
  dailyMinutes,
  profession: "Developer",
  primaryGoal: "Speak English with confidence",
  mainDifficulty: "speaking",
  initialSetupCompleted: true,
});

const buildProgress = (): ProgressSnapshot => ({
  level: "A1",
  speakingScore: 0,
  listeningScore: 0,
  vocabularyScore: 0,
  pronunciationScore: 0,
  consistencyScore: 0,
  studiedMinutesToday: 0,
  streakDays: 0,
});

const buildRepository = (profile = buildProfile(25)) => {
  let plan: DailyPlan | null = null;
  let progress = buildProgress();

  const repository = {
    findUserById: jest.fn(async () => profile),
    findPlanByUserAndDate: jest.fn(async () => plan),
    findOrCreateProgress: jest.fn(async () => progress),
    savePlan: jest.fn(async (nextPlan: Omit<DailyPlan, "id"> & { id?: string }) => {
      plan = { ...nextPlan, id: nextPlan.id ?? "plan-1" };
      return plan;
    }),
    updatePlanBlocks: jest.fn(async (nextPlan: DailyPlan) => {
      plan = nextPlan;
      return plan;
    }),
    saveProgress: jest.fn(async (_userId: string, nextProgress: ProgressSnapshot) => {
      progress = nextProgress;
      return progress;
    }),
  } as unknown as DailyPlanRepository;

  return {
    repository,
    getPlan: () => plan,
    getProgress: () => progress,
  };
};

describe("DailyPlanService.generatePlan", () => {
  it.each([10, 15, 25])("distributes %i minutes without exceeding the plan total", (dailyMinutes) => {
    const plan = service.generatePlan(buildProfile(dailyMinutes), "2026-07-11");

    expect(plan.totalMinutes).toBe(dailyMinutes);
    expect(plan.blocks).toHaveLength(6);
    expect(plan.blocks.every((block) => block.durationMinutes >= 1)).toBe(true);
    expect(plan.blocks.reduce((sum, block) => sum + block.durationMinutes, 0)).toBe(dailyMinutes);
  });

  it("can rotate the block order for a fresh plan in the same day", () => {
    const firstPlan = service.generatePlan(buildProfile(25), "2026-07-11");
    const nextPlan = service.generatePlan(buildProfile(25), "2026-07-11", 1);

    expect(nextPlan.date).toBe(firstPlan.date);
    expect(nextPlan.blocks.map((block) => block.type)).not.toEqual(firstPlan.blocks.map((block) => block.type));
    expect(nextPlan.totalMinutes).toBe(firstPlan.totalMinutes);
  });

  it("creates required completion steps for every generated block", () => {
    const plan = service.generatePlan(buildProfile(25), "2026-07-11");

    expect(plan.blocks.every((block) => (block.requiredSteps?.length ?? 0) > 0)).toBe(true);
    expect(plan.blocks.every((block) => block.status === "not_started")).toBe(true);
    expect(plan.blocks.every((block) => block.progressPercentage === 0)).toBe(true);
  });
});

describe("DailyPlanService.recordBlockEvidence", () => {
  it("records partial progress without completing the block too early", async () => {
    const { repository } = buildRepository();
    const planService = new DailyPlanService(repository);
    await planService.createOrGetTodayPlan("user-1");

    const result = await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "listening",
      evidenceType: "listening_attempt",
      evidenceRef: "line-1",
    });
    const listeningBlock = result.dailyPlan.blocks.find((block) => block.type === "listening");

    expect(listeningBlock?.completedSteps).toBe(2);
    expect(listeningBlock?.totalSteps).toBe(4);
    expect(listeningBlock?.progressPercentage).toBe(50);
    expect(listeningBlock?.status).toBe("in_progress");
    expect(result.progress.studiedMinutesToday).toBe(0);
  });

  it("completes a block only when all required steps are completed", async () => {
    const { repository } = buildRepository();
    const planService = new DailyPlanService(repository);
    await planService.createOrGetTodayPlan("user-1");
    await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "listening",
      evidenceType: "listening_attempt",
      evidenceRef: "line-1",
    });

    const result = await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "listening",
      evidenceType: "listening_completion",
      evidenceRef: "dialog-1",
    });
    const listeningBlock = result.dailyPlan.blocks.find((block) => block.type === "listening");

    expect(listeningBlock?.status).toBe("completed");
    expect(listeningBlock?.progressPercentage).toBe(100);
    expect(result.progress.studiedMinutesToday).toBe(listeningBlock?.durationMinutes);
  });

  it("does not duplicate progress for the same completed step", async () => {
    const { repository } = buildRepository();
    const planService = new DailyPlanService(repository);
    await planService.createOrGetTodayPlan("user-1");
    await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "shadowing",
      evidenceType: "practice_completion",
      evidenceRef: "phrase-1",
    });
    const firstResult = await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "shadowing",
      evidenceType: "practice_completion",
      evidenceRef: "phrase-1",
    });
    const shadowingBlock = firstResult.dailyPlan.blocks.find((block) => block.type === "shadowing");

    expect(shadowingBlock?.status).toBe("completed");
    expect(firstResult.progress.studiedMinutesToday).toBe(shadowingBlock?.durationMinutes);
  });

  it("marks the daily plan completed and increments streak when every block is completed", async () => {
    const { repository } = buildRepository();
    const planService = new DailyPlanService(repository);
    const initial = await planService.createOrGetTodayPlan("user-1");
    const totalMinutes = initial.dailyPlan.blocks.reduce((sum, block) => sum + block.durationMinutes, 0);

    await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "listening",
      evidenceType: "listening_attempt",
      evidenceRef: "line-1",
    });
    await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "listening",
      evidenceType: "listening_completion",
      evidenceRef: "dialog-1",
    });
    await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "shadowing",
      evidenceType: "practice_completion",
      evidenceRef: "shadowing-1",
    });
    await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "speaking-coach",
      evidenceType: "pronunciation_analysis",
      evidenceRef: "coach-1",
    });
    await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "conversation",
      evidenceType: "conversation_task",
      evidenceRef: "conversation-1",
    });
    await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "vocabulary",
      evidenceType: "vocabulary_recall",
      evidenceRef: "vocabulary-1",
    });
    const result = await planService.recordBlockEvidence({
      userId: "user-1",
      blockType: "review",
      evidenceType: "retention_review",
      evidenceRef: "review-1",
    });

    expect(result.dailyPlan.status).toBe("completed");
    expect(result.dailyPlan.completedAt).toBeTruthy();
    expect(result.progress.streakDays).toBe(1);
    expect(result.progress.studiedMinutesToday).toBe(totalMinutes);
  });
});
