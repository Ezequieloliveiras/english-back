import { Schema, model } from "mongoose";

const contentCatalogSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    items: { type: [Schema.Types.Mixed], required: true, default: [] },
  },
  { timestamps: true }
);

export const ContentCatalogModel = model("ContentCatalog", contentCatalogSchema);
