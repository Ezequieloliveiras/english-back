import { describe, expect, it, jest } from "@jest/globals";
import { DailyPlanService } from "../services/dailyPlan.service";
import { ProfilePlanService } from "../services/profilePlan.service";

const buildDailyPlanService = () =>
  ({
    createPlanForProfile: jest.fn(async (_userId: string, profile: any) => ({
      user: {
        id: "user-1",
        email: "test@example.com",
        ...profile,
      },
      dailyPlan: {
        id: "plan-1",
        focus: "Professional focus",
        blocks: [],
      },
      progress: {
        level: profile.currentLevel,
        speakingScore: 0,
        listeningScore: 0,
        vocabularyScore: 0,
        pronunciationScore: 0,
        consistencyScore: 0,
        studiedMinutesToday: 0,
        streakDays: 0,
      },
    })),
  }) as unknown as DailyPlanService;

const baseInput = {
  name: "Alex",
  objective: "Speak better in meetings",
  level: "A2" as const,
  dailyMinutes: 25,
  profession: "Marketing",
  difficulty: "speaking" as const,
};

describe("ProfilePlanService professional focus", () => {
  it("accepts a recognized profession when professional focus is enabled", async () => {
    const dailyPlanService = buildDailyPlanService();
    const service = new ProfilePlanService(dailyPlanService);

    const result = await service.buildPlan("user-1", {
      ...baseInput,
      professionalFocusMode: "profession",
    });

    expect(result.status).toBe(201);
    const body = result.body as any;
    expect(body.profile.professionalFocusMode).toBe("profession");
    expect(body.profile.professionValidationStatus).toBe("verified");
  });

  it("rejects illegal or harmful activity when professional focus is enabled", async () => {
    const dailyPlanService = buildDailyPlanService();
    const service = new ProfilePlanService(dailyPlanService);

    const result = await service.buildPlan("user-1", {
      ...baseInput,
      profession: "phishing",
      professionalFocusMode: "profession",
    });

    expect(result.status).toBe(400);
    expect(result.body.message).toContain("ilegal");
  });

  it("keeps smart default without requiring deep profession validation", async () => {
    const dailyPlanService = buildDailyPlanService();
    const service = new ProfilePlanService(dailyPlanService);

    const result = await service.buildPlan("user-1", {
      ...baseInput,
      profession: "Minha area interna",
      professionalFocusMode: "standard",
    });

    expect(result.status).toBe(201);
    const body = result.body as any;
    expect(body.profile.professionalFocusMode).toBe("standard");
    expect(body.profile.professionValidationStatus).toBe("unchecked");
  });
});
