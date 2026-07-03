import mongoose from "mongoose";
import { env } from "./env";

let isConnected = false;

export const connectDatabase = async () => {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(env.mongoUri);
    isConnected = true;
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB unavailable. Real data features require a database connection.");
    console.error(error);
  }
};
