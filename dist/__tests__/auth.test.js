"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const supertest_1 = __importDefault(require("supertest"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const app_1 = require("../app");
const env_1 = require("../config/env");
let mongo;
beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    mongo = await mongodb_memory_server_1.MongoMemoryServer.create();
    await mongoose_1.default.connect(mongo.getUri());
});
afterAll(async () => {
    await mongoose_1.default.disconnect();
    await mongo.stop();
});
beforeEach(async () => {
    await mongoose_1.default.connection.db?.dropDatabase();
});
describe("auth flow", () => {
    it("registers a user, sets an httpOnly cookie, and reads /auth/me through the cookie", async () => {
        const agent = supertest_1.default.agent(app_1.app);
        const registerResponse = await agent
            .post("/api/auth/register")
            .send({
            name: "Test User",
            email: "test@example.com",
            password: "password123",
        })
            .expect(201);
        const cookies = registerResponse.headers["set-cookie"];
        expect(registerResponse.body.user.email).toBe("test@example.com");
        expect(cookies.join(";")).toContain(env_1.env.authCookieName);
        expect(cookies.join(";").toLowerCase()).toContain("httponly");
        const meResponse = await agent.get("/api/auth/me").expect(200);
        expect(meResponse.body.user.email).toBe("test@example.com");
    });
    it("blocks protected routes without a cookie or bearer token", async () => {
        await (0, supertest_1.default)(app_1.app).get("/api/auth/me").expect(401);
    });
    it("clears the auth cookie on logout", async () => {
        const agent = supertest_1.default.agent(app_1.app);
        await agent
            .post("/api/auth/register")
            .send({
            name: "Logout User",
            email: "logout@example.com",
            password: "password123",
        })
            .expect(201);
        const logoutResponse = await agent.post("/api/auth/logout").expect(200);
        const cookies = logoutResponse.headers["set-cookie"];
        expect(cookies.join(";")).toContain(`${env_1.env.authCookieName}=`);
        expect(cookies.join(";")).toContain("Expires=Thu, 01 Jan 1970");
    });
    it("sets security headers through Helmet", async () => {
        const response = await (0, supertest_1.default)(app_1.app).get("/api/health").expect(200);
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });
});
