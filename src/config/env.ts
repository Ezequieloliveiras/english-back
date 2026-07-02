import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/english-os",
  jwtSecret: process.env.JWT_SECRET ?? "change-me",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
};
