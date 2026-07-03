import { Response } from "express";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AuthService } from "../services/auth.service";

const setAuthCookie = (response: Response, token?: string) => {
  if (!token) return;

  response.cookie(env.authCookieName, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

const clearAuthCookie = (response: Response) => {
  response.clearCookie(env.authCookieName, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    path: "/",
  });
};

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (request: AuthenticatedRequest, response: Response) => {
    try {
      const result = await this.authService.register(request.body);
      setAuthCookie(response, "token" in result.body ? result.body.token : undefined);
      response.status(result.status).json(result.body);
    } catch {
      response.status(500).json({ message: "Registration failed" });
    }
  };

  login = async (request: AuthenticatedRequest, response: Response) => {
    try {
      const result = await this.authService.login(request.body);
      setAuthCookie(response, "token" in result.body ? result.body.token : undefined);
      response.status(result.status).json(result.body);
    } catch {
      response.status(500).json({ message: "Login failed" });
    }
  };

  me = async (request: AuthenticatedRequest, response: Response) => {
    try {
      if (!request.auth?.userId) {
        response.status(401).json({ message: "Authentication required" });
        return;
      }

      const result = await this.authService.me(request.auth.userId);
      response.status(result.status).json(result.body);
    } catch {
      response.status(500).json({ message: "Profile lookup failed" });
    }
  };

  logout = async (_request: AuthenticatedRequest, response: Response) => {
    clearAuthCookie(response);
    response.json({ message: "Logged out" });
  };
}
