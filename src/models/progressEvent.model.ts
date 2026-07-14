import { Schema, model } from "mongoose";

const progressEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    eventKey: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    source: { type: String, required: true },
    sourceId: { type: String, required: true },
    occurredAt: { type: Date, required: true, default: Date.now },
    payload: { type: Schema.Types.Mixed, required: true, default: {} },
  },
  { timestamps: true }
);

progressEventSchema.index({ userId: 1, type: 1, occurredAt: -1 });
progressEventSchema.index({ source: 1, sourceId: 1 });

export const ProgressEventModel = model("ProgressEvent", progressEventSchema);
