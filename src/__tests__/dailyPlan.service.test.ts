import { describe, expect, it } from "@jest/globals";
import { DailyPlanRepository } from "../repositories/dailyPlan.repository";
import { DailyPlanService } from "../services/dailyPlan.service";
import { UserProfile } from "../types";

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
});

describe("DailyPlanService.generatePlan", () => {
  it.each([10, 15, 25])("distributes %i minutes without exceeding the plan total", (dailyMinutes) => {
    const plan = service.generatePlan(buildProfile(dailyMinutes), "2026-07-11");

    expect(plan.totalMinutes).toBe(dailyMinutes);
    expect(plan.blocks).toHaveLength(6);
    expect(plan.blocks.every((block) => block.durationMinutes >= 1)).toBe(true);
    expect(plan.blocks.reduce((sum, block) => sum + block.durationMinutes, 0)).toBe(dailyMinutes);
  });
});
