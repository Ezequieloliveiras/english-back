"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationSessionModel = void 0;
const mongoose_1 = require("mongoose");
const messageSchema = new mongoose_1.Schema({
    role: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
}, { _id: false });
const conversationSessionSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    mode: { type: String, required: true },
    modeId: { type: String },
    title: { type: String },
    messages: { type: [messageSchema], required: true },
    corrections: { type: [String], default: [] },
    suggestedPhrases: { type: [String], default: [] },
    mistakes: { type: [mongoose_1.Schema.Types.ObjectId], ref: "StudentMistake", default: [] },
}, { timestamps: true });
exports.ConversationSessionModel = (0, mongoose_1.model)("ConversationSession", conversationSessionSchema);
