import mongoose from "mongoose";
import { dashboardMock } from "../data/mockData";
import { DailyPlanModel } from "../models/dailyPlan.model";
import { ProgressModel } from "../models/progress.model";
import { UserModel } from "../models/user.model";
import { DailyPlan, ProgressSnapshot, StudyBlock, UserProfile } from "../types";

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const toPlainId = (value: unknown) => String(value ?? "");

const mapBlock = (block: any): StudyBlock => ({
  id: block.id,
  title: block.title,
  type: block.type,
  durationMinutes: block.durationMinutes,
  status: block.status,
  progress: block.progress,
  objective: block.objective,
});

const mapPlan = (plan: any): DailyPlan => ({
  id: toPlainId(plan._id ?? plan.id),
  userId: toPlainId(plan.userId),
  focus: plan.focus,
  totalMinutes: plan.totalMinutes,
  streak: plan.streak,
  date: plan.date,
  blocks: plan.blocks.map(mapBlock),
});

const mapUser = (user: any): UserProfile => ({
  id: toPlainId(user._id ?? user.id),
  name: user.name,
  email: user.email,
  currentLevel: user.currentLevel,
  dailyMinutes: user.dailyMinutes,
  profession: user.profession,
  primaryGoal: user.primaryGoal,
  mainDifficulty: user.mainDifficulty,
});

const mapProgress = (progress: any): ProgressSnapshot => ({
  level: progress.level,
  speakingScore: progress.speakingScore,
  listeningScore: progress.listeningScore,
  vocabularyScore: progress.vocabularyScore,
  pronunciationScore: progress.pronunciationScore,
  consistencyScore: progress.consistencyScore,
  studiedMinutesToday: progress.studiedMinutesToday,
  streakDays: progress.streakDays,
});

const createInitialProgress = (level: UserProfile["currentLevel"]): ProgressSnapshot => ({
  level,
  speakingScore: 0,
  listeningScore: 0,
  vocabularyScore: 0,
  pronunciationScore: 0,
  consistencyScore: 0,
  studiedMinutesToday: 0,
  streakDays: 0,
});

const isLegacyDemoProgress = (progress: ProgressSnapshot) =>
  progress.speakingScore === 64 &&
  progress.listeningScore === 71 &&
  progress.vocabularyScore === 69 &&
  progress.pronunciationScore === 58 &&
  progress.consistencyScore === 88 &&
  progress.studiedMinutesToday === 0 &&
  progress.streakDays === 14;

const memoryState = {
  users: new Map<string, UserProfile>(),
  plans: new Map<string, DailyPlan>(),
  progress: new Map<string, ProgressSnapshot>(),
};

export class DailyPlanRepository {
  async findOrCreateDemoUser(profile?: Partial<UserProfile>) {
    const demoEmail = profile?.email ?? dashboardMock.user.email;

    if (!isDatabaseReady()) {
      const existing = [...memoryState.users.values()].find((user) => user.email === demoEmail);

      if (existing) {
        const updated = { ...existing, ...profile, id: existing.id };
        memoryState.users.set(updated.id, updated);
        return updated;
      }

      const user: UserProfile = {
        ...dashboardMock.user,
        ...profile,
        id: `user-${memoryState.users.size + 1}`,
        email: demoEmail,
      };
      memoryState.users.set(user.id, user);
      return user;
    }

    const user = await UserModel.findOneAndUpdate(
      { email: demoEmail },
      {
        $set: {
          name: profile?.name ?? dashboardMock.user.name,
          email: demoEmail,
          currentLevel: profile?.currentLevel ?? dashboardMock.user.currentLevel,
          dailyMinutes: profile?.dailyMinutes ?? dashboardMock.user.dailyMinutes,
          profession: profile?.profession ?? dashboardMock.user.profession,
          primaryGoal: profile?.primaryGoal ?? dashboardMock.user.primaryGoal,
          mainDifficulty: profile?.mainDifficulty ?? dashboardMock.user.mainDifficulty,
        },
      },
      { new: true, upsert: true }
    );

    return mapUser(user);
  }

  async findUserById(userId: string) {
    if (!isDatabaseReady()) {
      return memoryState.users.get(userId) ?? null;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await UserModel.findById(userId);
    return user ? mapUser(user) : null;
  }

  async findPlanByUserAndDate(userId: string, date: string) {
    if (!isDatabaseReady()) {
      return memoryState.plans.get(`${userId}:${date}`) ?? null;
    }

    const plan = await DailyPlanModel.findOne({ userId, date });
    return plan ? mapPlan(plan) : null;
  }

  async savePlan(plan: Omit<DailyPlan, "id"> & { id?: string }) {
    if (!isDatabaseReady()) {
      const id = plan.id ?? `plan-${memoryState.plans.size + 1}`;
      const saved = { ...plan, id };
      memoryState.plans.set(`${saved.userId}:${saved.date}`, saved);
      return saved;
    }

    const saved = await DailyPlanModel.findOneAndUpdate(
      { userId: plan.userId, date: plan.date },
      {
        $set: {
          focus: plan.focus,
          totalMinutes: plan.totalMinutes,
          streak: plan.streak,
          date: plan.date,
          blocks: plan.blocks,
        },
      },
      { new: true, upsert: true }
    );

    return mapPlan(saved);
  }

  async updatePlanBlocks(plan: DailyPlan) {
    if (!isDatabaseReady()) {
      memoryState.plans.set(`${plan.userId}:${plan.date}`, plan);
      return plan;
    }

    const updated = await DailyPlanModel.findByIdAndUpdate(
      plan.id,
      { $set: { blocks: plan.blocks } },
      { new: true }
    );

    return updated ? mapPlan(updated) : null;
  }

  async findOrCreateProgress(user: UserProfile) {
    if (!isDatabaseReady()) {
      const existing = memoryState.progress.get(user.id);

      if (existing) {
        if (isLegacyDemoProgress(existing)) {
          const resetProgress = createInitialProgress(user.currentLevel);
          memoryState.progress.set(user.id, resetProgress);
          return resetProgress;
        }

        return existing;
      }

      const progress = createInitialProgress(user.currentLevel);
      memoryState.progress.set(user.id, progress);
      return progress;
    }

    const progress = await ProgressModel.findOneAndUpdate(
      { userId: user.id },
      {
        $setOnInsert: {
          ...createInitialProgress(user.currentLevel),
        },
      },
      { new: true, upsert: true }
    );

    const mappedProgress = mapProgress(progress);

    if (isLegacyDemoProgress(mappedProgress)) {
      const resetProgress = await ProgressModel.findOneAndUpdate(
        { userId: user.id },
        { $set: createInitialProgress(user.currentLevel) },
        { new: true }
      );

      return mapProgress(resetProgress);
    }

    return mappedProgress;
  }

  async saveProgress(userId: string, progress: ProgressSnapshot) {
    if (!isDatabaseReady()) {
      memoryState.progress.set(userId, progress);
      return progress;
    }

    const saved = await ProgressModel.findOneAndUpdate(
      { userId },
      { $set: progress },
      { new: true, upsert: true }
    );

    return mapProgress(saved);
  }
}
