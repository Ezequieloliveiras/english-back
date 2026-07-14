"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
let isConnected = false;
const connectDatabase = async () => {
    if (isConnected) {
        return;
    }
    try {
        await mongoose_1.default.connect(env_1.env.mongoUri);
        isConnected = true;
        console.log("MongoDB connected");
    }
    catch (error) {
        console.error("MongoDB unavailable. Real data features require a database connection.");
        console.error(error);
        if (env_1.env.nodeEnv === "production") {
            throw error;
        }
        console.warn("PERSISTENCE_FALLBACK_ACTIVE: in-memory persistence may be used outside production.");
    }
};
exports.connectDatabase = connectDatabase;
