"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressEventModel = void 0;
const mongoose_1 = require("mongoose");
const progressEventSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    eventKey: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    source: { type: String, required: true },
    sourceId: { type: String, required: true },
    occurredAt: { type: Date, required: true, default: Date.now },
    payload: { type: mongoose_1.Schema.Types.Mixed, required: true, default: {} },
}, { timestamps: true });
progressEventSchema.index({ userId: 1, type: 1, occurredAt: -1 });
progressEventSchema.index({ source: 1, sourceId: 1 });
exports.ProgressEventModel = (0, mongoose_1.model)("ProgressEvent", progressEventSchema);
