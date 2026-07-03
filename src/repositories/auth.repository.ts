import { UserModel } from "../models/user.model";
import { UserProfile } from "../types";

const toPlainId = (value: unknown) => String(value ?? "");

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

export class AuthRepository {
  async findByEmail(email: string) {
    return UserModel.findOne({ email: email.toLowerCase().trim() });
  }

  async findById(userId: string) {
    const user = await UserModel.findById(userId);
    return user ? mapUser(user) : null;
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
  }) {
    const user = await UserModel.create({
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      currentLevel: "A1",
      dailyMinutes: 25,
      profession: "Not defined",
      primaryGoal: "Speak English with confidence",
      mainDifficulty: "speaking",
    });

    return mapUser(user);
  }
}
