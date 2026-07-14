import mongoose from "mongoose";
import { env } from "../config/env";
import { dashboardSeed } from "../data/seedData";
import { ContentCatalogModel } from "../models/contentCatalog.model";
import { normalizeShadowingItem } from "../utils/trainingPhrase";

type Report = {
  found: number;
  corrected: number;
  failed: number;
};

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const report: Report = {
    found: 0,
    corrected: 0,
    failed: 0,
  };

  const catalog = await ContentCatalogModel.findOne({ key: "shadowingItems" });

  if (!catalog) {
    console.log("TRAINING_PHRASE_BACKFILL_REPORT", report);
    await mongoose.disconnect();
    return;
  }

  const seedById = new Map(dashboardSeed.shadowingItems.map((item) => [item.id, item]));
  const seedByText = new Map(dashboardSeed.shadowingItems.map((item) => [item.text, item]));
  const nextItems = [];
  let changed = false;

  for (const item of catalog.items ?? []) {
    report.found += 1;
    const record = item as Record<string, any>;
    const text = typeof record.text === "string" ? record.text : record.phrase;
    const fallback = seedById.get(record.id) ?? seedByText.get(text);
    const normalized = normalizeShadowingItem(record, fallback);

    if (!normalized?.translation) {
      report.failed += 1;
      console.warn("TRAINING_PHRASE_TRANSLATION_MISSING", { id: record.id, text });
      nextItems.push(item);
      continue;
    }

    nextItems.push(normalized);

    if (JSON.stringify(record) !== JSON.stringify(normalized)) {
      changed = true;
      report.corrected += 1;
      console.log("TRAINING_PHRASE_TRANSLATION_BACKFILLED", { id: normalized.id });
    }
  }

  if (changed) {
    catalog.items = nextItems;
    await catalog.save();
  }

  console.log("TRAINING_PHRASE_BACKFILL_REPORT", report);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("TRAINING_PHRASE_INVALID_PAYLOAD", {
    message: error instanceof Error ? error.message : "Unknown backfill error",
  });
  await mongoose.disconnect().catch(() => null);
  process.exitCode = 1;
});
