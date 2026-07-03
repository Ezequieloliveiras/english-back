"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const env_1 = require("../config/env");
const setAuthCookie = (response, token) => {
    if (!token)
        return;
    response.cookie(env_1.env.authCookieName, token, {
        httpOnly: true,
        secure: env_1.env.nodeEnv === "production",
        sameSite: env_1.env.nodeEnv === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
    });
};
const clearAuthCookie = (response) => {
    response.clearCookie(env_1.env.authCookieName, {
        httpOnly: true,
        secure: env_1.env.nodeEnv === "production",
        sameSite: env_1.env.nodeEnv === "production" ? "none" : "lax",
        path: "/",
    });
};
class AuthController {
    constructor(authService) {
        this.authService = authService;
        this.register = async (request, response) => {
            try {
                const result = await this.authService.register(request.body);
                setAuthCookie(response, "token" in result.body ? result.body.token : undefined);
                response.status(result.status).json(result.body);
            }
            catch {
                response.status(500).json({ message: "Registration failed" });
            }
        };
        this.login = async (request, response) => {
            try {
                const result = await this.authService.login(request.body);
                setAuthCookie(response, "token" in result.body ? result.body.token : undefined);
                response.status(result.status).json(result.body);
            }
            catch {
                response.status(500).json({ message: "Login failed" });
            }
        };
        this.me = async (request, response) => {
            try {
                if (!request.auth?.userId) {
                    response.status(401).json({ message: "Authentication required" });
                    return;
                }
                const result = await this.authService.me(request.auth.userId);
                response.status(result.status).json(result.body);
            }
            catch {
                response.status(500).json({ message: "Profile lookup failed" });
            }
        };
        this.logout = async (_request, response) => {
            clearAuthCookie(response);
            response.json({ message: "Logged out" });
        };
    }
}
exports.AuthController = AuthController;
