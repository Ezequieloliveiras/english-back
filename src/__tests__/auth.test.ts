import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { app } from "../app";
import { env } from "../config/env";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

describe("auth flow", () => {
  it("registers a user, sets an httpOnly cookie, and reads /auth/me through the cookie", async () => {
    const agent = request.agent(app);
    const registerResponse = await agent
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      })
      .expect(201);

    const cookies = registerResponse.headers["set-cookie"] as unknown as string[];

    expect(registerResponse.body.user.email).toBe("test@example.com");
    expect(cookies.join(";")).toContain(env.authCookieName);
    expect(cookies.join(";").toLowerCase()).toContain("httponly");

    const meResponse = await agent.get("/api/auth/me").expect(200);

    expect(meResponse.body.user.email).toBe("test@example.com");
  });

  it("blocks protected routes without a cookie or bearer token", async () => {
    await request(app).get("/api/auth/me").expect(401);
  });

  it("clears the auth cookie on logout", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({
        name: "Logout User",
        email: "logout@example.com",
        password: "password123",
      })
      .expect(201);

    const logoutResponse = await agent.post("/api/auth/logout").expect(200);
    const cookies = logoutResponse.headers["set-cookie"] as unknown as string[];

    expect(cookies.join(";")).toContain(`${env.authCookieName}=`);
    expect(cookies.join(";")).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("sets security headers through Helmet", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
