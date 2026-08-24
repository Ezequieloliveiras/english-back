import { assessProficiency } from "../services/curriculum.service";
import { ProgressSnapshot, UserProfile } from "../types";
import { describe, expect, it } from "@jest/globals";

const profile: UserProfile = {
  id: "user-1", name: "Ana", email: "ana@example.com", currentLevel: "A2", dailyMinutes: 30,
  profession: "Developer", primaryGoal: "Falar no trabalho", mainDifficulty: "speaking", initialSetupCompleted: true,
};
const progress: ProgressSnapshot = { level: "A2", speakingScore: 0, listeningScore: 0, vocabularyScore: 0, pronunciationScore: 0, consistencyScore: 0, studiedMinutesToday: 0, streakDays: 0 };

describe("assessProficiency", () => {
  it("does not mistake plan completion for a calibrated CEFR result", () => {
    const assessment = assessProficiency({ profile, progress, listening: [], speaking: [], vocabulary: [], completedInteractions: 5 });

    expect(assessment.estimatedLevel).toBe("A2");
    expect(assessment.calibrated).toBe(false);
    expect(assessment.confidence).toBe("insufficient");
    expect(assessment.skillEvidence.listening.status).toBe("not_enough_data");
  });

  it("uses evaluated attempts and selects concrete next competencies", () => {
    const assessment = assessProficiency({
      profile, progress,
      listening: Array.from({ length: 8 }, () => ({ comprehensionCorrect: true, replayCount: 1 })),
      speaking: Array.from({ length: 8 }, () => ({ pronunciationScore: 8, naturalnessScore: 7, fluencyScore: 7 })),
      vocabulary: [{ timesPracticed: 12, timesCorrect: 10 }],
      completedInteractions: 4,
    });

    expect(assessment.confidence).toBe("developing");
    expect(assessment.skillEvidence.listening.score).toBeGreaterThan(80);
    expect(assessment.nextCompetencies.length).toBeGreaterThan(0);
    expect(assessment.explanation).toContain("faltam");
  });

  it("can lower an overstated working level only after substantial weak evidence", () => {
    const assessment = assessProficiency({
      profile, progress,
      listening: Array.from({ length: 16 }, () => ({ comprehensionCorrect: false, translationOpened: true, replayCount: 3 })),
      speaking: Array.from({ length: 16 }, () => ({ pronunciationScore: 3, naturalnessScore: 3, fluencyScore: 3 })),
      vocabulary: [{ timesPracticed: 16, timesCorrect: 4 }],
      completedInteractions: 2,
    });

    expect(assessment.calibrated).toBe(true);
    expect(assessment.estimatedLevel).toBe("A1");
  });
});
