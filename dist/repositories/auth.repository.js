"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const user_model_1 = require("../models/user.model");
const toPlainId = (value) => String(value ?? "");
const mapUser = (user) => ({
    id: toPlainId(user._id ?? user.id),
    name: user.name,
    email: user.email,
    currentLevel: user.currentLevel,
    dailyMinutes: user.dailyMinutes,
    profession: user.profession,
    primaryGoal: user.primaryGoal,
    mainDifficulty: user.mainDifficulty,
    initialSetupCompleted: Boolean(user.initialSetupCompleted),
});
class AuthRepository {
    async findByEmail(email) {
        return user_model_1.UserModel.findOne({ email: email.toLowerCase().trim() });
    }
    async findById(userId) {
        const user = await user_model_1.UserModel.findById(userId);
        return user ? mapUser(user) : null;
    }
    async createUser(input) {
        const user = await user_model_1.UserModel.create({
            name: input.name.trim(),
            email: input.email.toLowerCase().trim(),
            passwordHash: input.passwordHash,
            currentLevel: "A1",
            dailyMinutes: 25,
            profession: "Not defined",
            primaryGoal: "Speak English with confidence",
            mainDifficulty: "speaking",
            initialSetupCompleted: false,
        });
        return mapUser(user);
    }
}
exports.AuthRepository = AuthRepository;
