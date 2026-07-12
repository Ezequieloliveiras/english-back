import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { UserModel } from "../models/user.model";
import { LearningService } from "../services/learning.service";

let mongo: MongoMemoryServer;
const service = new LearningService();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

const createUser = async () =>
  UserModel.create({
    name: "Learning User",
    email: "learning@example.com",
    currentLevel: "A1.1",
    dailyMinutes: 25,
    profession: "Developer",
    primaryGoal: "B2",
    mainDifficulty: "listening",
  });

describe("LearningService", () => {
  it("exposes the full A1.1 to B2.2 roadmap", () => {
    const roadmap = service.getRoadmap();

    expect(roadmap.levels.map((level) => level.code)).toEqual([
      "A1.1",
      "A1.2",
      "A2.1",
      "A2.2",
      "B1.1",
      "B1.2",
      "B2.1",
      "B2.2",
    ]);
    expect(roadmap.competencies.length).toBeGreaterThanOrEqual(20);
    expect(roadmap.units.some((unit) => unit.level === "A1.1")).toBe(true);
  });

  it("records competency evidence without granting mastery from one attempt", async () => {
    const user = await createUser();
    const progress = await service.recordEvidence({
      userId: String(user._id),
      competencyId: "a1-1-introduce-yourself",
      evidence: {
        type: "speaking_attempt",
        score: 90,
        sourceId: "test-speaking",
      },
    });

    expect(progress?.masteryScore).toBe(90);
    expect(progress?.attempts).toBe(1);
    expect(progress?.status).not.toBe("mastered");
  });

  it("creates a level progress snapshot from mastered competencies", async () => {
    const user = await createUser();

    for (let index = 0; index < 3; index += 1) {
      await service.recordEvidence({
        userId: String(user._id),
        competencyId: "a1-1-introduce-yourself",
        evidence: {
          type: index === 2 ? "retention_review" : "speaking_attempt",
          score: 85,
          sourceId: `attempt-${index}`,
        },
      });
    }

    const levelProgress = await service.getUserLevelProgress(String(user._id));

    expect(levelProgress?.currentLevel).toBe("A1.1");
    expect(levelProgress?.competenciesRequired).toBe(3);
    expect(levelProgress?.competenciesMastered).toBe(1);
  });
});
