import mongoose from "mongoose";
import { UserGoalModel } from "../models/userGoal.model";
import { EnglishLevel } from "../types";

export interface UserGoalRecord {
  id: string;
  userId: string;
  primaryGoal: string;
  targetLevel: EnglishLevel;
  professionalContext: string;
  deadline?: string;
  createdAt?: string;
  updatedAt?: string;
}

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const mapGoal = (goal: any): UserGoalRecord => ({
  id: String(goal._id ?? goal.id),
  userId: String(goal.userId),
  primaryGoal: goal.primaryGoal,
  targetLevel: goal.targetLevel,
  professionalContext: goal.professionalContext ?? "",
  deadline: goal.deadline?.toISOString?.(),
  createdAt: goal.createdAt?.toISOString?.(),
  updatedAt: goal.updatedAt?.toISOString?.(),
});

const memoryGoals = new Map<string, UserGoalRecord>();

export class UserGoalRepository {
  async findByUserId(userId: string) {
    if (!isDatabaseReady()) {
      return memoryGoals.get(userId) ?? null;
    }

    const goal = await UserGoalModel.findOne({ userId });
    return goal ? mapGoal(goal) : null;
  }

  async upsertGoal(userId: string, input: {
    primaryGoal: string;
    targetLevel: EnglishLevel;
    professionalContext?: string;
    deadline?: string | Date;
  }) {
    if (!isDatabaseReady()) {
      const now = new Date().toISOString();
      const existing = memoryGoals.get(userId);
      const saved = {
        id: existing?.id ?? `goal-${userId}`,
        userId,
        primaryGoal: input.primaryGoal,
        targetLevel: input.targetLevel,
        professionalContext: input.professionalContext ?? "",
        deadline: input.deadline ? new Date(input.deadline).toISOString() : undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      memoryGoals.set(userId, saved);
      return saved;
    }

    const update: Record<string, unknown> = {
      $set: {
        primaryGoal: input.primaryGoal,
        targetLevel: input.targetLevel,
        professionalContext: input.professionalContext ?? "",
      },
    };

    if (input.deadline) {
      update.$set = { ...(update.$set as Record<string, unknown>), deadline: new Date(input.deadline) };
    } else {
      update.$unset = { deadline: "" };
    }

    const goal = await UserGoalModel.findOneAndUpdate(
      { userId },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return mapGoal(goal);
  }
}
