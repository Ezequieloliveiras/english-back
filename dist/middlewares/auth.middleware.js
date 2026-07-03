"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const requireAuth = (request, response, next) => {
    const header = request.headers.authorization;
    const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const token = request.cookies?.[env_1.env.authCookieName] ?? bearerToken;
    if (!token) {
        response.status(401).json({ message: "Authentication required" });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        if (!payload.userId) {
            response.status(401).json({ message: "Invalid token" });
            return;
        }
        request.auth = { userId: payload.userId };
        next();
    }
    catch {
        response.status(401).json({ message: "Invalid token" });
    }
};
exports.requireAuth = requireAuth;
