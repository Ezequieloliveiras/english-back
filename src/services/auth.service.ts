import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthRepository } from "../repositories/auth.repository";

const MIN_PASSWORD_LENGTH = 8;

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  private signToken(userId: string) {
    return jwt.sign({ userId }, env.jwtSecret, { expiresIn: "7d" });
  }

  async register(input: { name?: string; email?: string; password?: string }) {
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

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.authRepository.createUser({ name, email, passwordHash });

    return {
      status: 201,
      body: {
        token: this.signToken(user.id),
        user,
      },
    };
  }

  async login(input: { email?: string; password?: string }) {
    const email = input.email?.toLowerCase().trim();
    const password = input.password ?? "";

    if (!email || !password) {
      return { status: 400, body: { message: "Email and password are required" } };
    }

    const userRecord = await this.authRepository.findByEmail(email);

    if (!userRecord?.passwordHash) {
      return { status: 401, body: { message: "Invalid credentials" } };
    }

    const passwordMatches = await bcrypt.compare(password, userRecord.passwordHash);

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

  async me(userId: string) {
    const user = await this.authRepository.findById(userId);

    if (!user) {
      return { status: 404, body: { message: "User not found" } };
    }

    return { status: 200, body: { user } };
  }
}
