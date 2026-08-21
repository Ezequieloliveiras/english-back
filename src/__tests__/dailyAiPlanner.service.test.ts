import { describe, expect, it } from "@jest/globals";
import { DailyAiPlannerService } from "../services/dailyAiPlanner.service";
import { LearningStateService } from "../services/learningState.service";
import { DailyPlan, ProgressSnapshot, UserProfile } from "../types";

const user: UserProfile = { id: "memory-user", name: "Test", email: "test@example.com", currentLevel: "A2", dailyMinutes: 20, profession: "", primaryGoal: "travel", mainDifficulty: "listening", initialSetupCompleted: true };
const progress: ProgressSnapshot = { level: "A2", listeningScore: 42, speakingScore: 60, vocabularyScore: 55, pronunciationScore: 58, consistencyScore: 20, studiedMinutesToday: 0, streakDays: 1 };
const plan: DailyPlan = { id: "plan-1", userId: user.id, focus: "Listening", totalMinutes: 20, streak: 1, date: "2026-08-21", blocks: [{ id: "l", title: "Listening", type: "listening", durationMinutes: 10, status: "not_started", progress: 0, objective: "Practice listening" }, { id: "v", title: "Vocabulary", type: "vocabulary", durationMinutes: 10, status: "not_started", progress: 0, objective: "Practice vocabulary" }] };

describe("AI daily planning foundation", () => {
  it("builds a bounded learning state from real current metrics", async () => {
    const state = await new LearningStateService().build({ user, progress, dueReviews: [], recentPlans: [plan] });
    expect(state.level).toBe("A2");
    expect(state.progress.listeningScore).toBe(42);
    expect(state.recentPlans[0].date).toBe(plan.date);
  });

  it("uses a persisted-compatible local blueprint when the feature flag is disabled", async () => {
    const planner = new DailyAiPlannerService({ generateAdaptiveDailyPlan: async () => { throw new Error("should not run"); } } as any);
    const blueprint = await planner.create(plan, await new LearningStateService().build({ user, progress, dueReviews: [], recentPlans: [plan] }));
    expect(blueprint.generationSource).toBe("local");
    expect(blueprint.activities).toHaveLength(2);
    expect(blueprint.activities[0].status).toBe("planned");
  });
});
