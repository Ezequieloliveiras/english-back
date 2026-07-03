import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthenticatedRequest extends Request {
  cookies: Record<string, string | undefined>;
  auth?: {
    userId: string;
  };
}

export const requireAuth = (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) => {
  const header = request.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = request.cookies?.[env.authCookieName] ?? bearerToken;

  if (!token) {
    response.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId?: string };

    if (!payload.userId) {
      response.status(401).json({ message: "Invalid token" });
      return;
    }

    request.auth = { userId: payload.userId };
    next();
  } catch {
    response.status(401).json({ message: "Invalid token" });
  }
};
