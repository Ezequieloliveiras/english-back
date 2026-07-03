"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const MIN_PASSWORD_LENGTH = 8;
class AuthService {
    constructor(authRepository) {
        this.authRepository = authRepository;
    }
    signToken(userId) {
        return jsonwebtoken_1.default.sign({ userId }, env_1.env.jwtSecret, { expiresIn: "7d" });
    }
    async register(input) {
        const name = input.name?.trim();
        const email = input.email?.toLowerCase().trim();
        const password = input.password ?? "";
        if (!name || !email || password.length < MIN_PASSWORD_LENGTH) {
            return {
                status: 400,
                body: { message: "Name, valid email and password with at least 8 characters are required" },
            };
        }
        const existing = await this.authRepository.findByEmail(email);
        if (existing) {
            return { status: 409, body: { message: "Email already registered" } };
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await this.authRepository.createUser({ name, email, passwordHash });
        return {
            status: 201,
            body: {
                token: this.signToken(user.id),
                user,
            },
        };
    }
    async login(input) {
        const email = input.email?.toLowerCase().trim();
        const password = input.password ?? "";
        if (!email || !password) {
            return { status: 400, body: { message: "Email and password are required" } };
        }
        const userRecord = await this.authRepository.findByEmail(email);
        if (!userRecord?.passwordHash) {
            return { status: 401, body: { message: "Invalid credentials" } };
        }
        const passwordMatches = await bcryptjs_1.default.compare(password, userRecord.passwordHash);
        if (!passwordMatches) {
            return { status: 401, body: { message: "Invalid credentials" } };
        }
        const user = await this.authRepository.findById(String(userRecord._id));
        return {
            status: 200,
            body: {
                token: this.signToken(String(userRecord._id)),
                user,
            },
        };
    }
    async me(userId) {
        const user = await this.authRepository.findById(userId);
        if (!user) {
            return { status: 404, body: { message: "User not found" } };
        }
        return { status: 200, body: { user } };
    }
}
exports.AuthService = AuthService;
