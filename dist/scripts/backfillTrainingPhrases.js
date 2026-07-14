"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
const seedData_1 = require("../data/seedData");
const contentCatalog_model_1 = require("../models/contentCatalog.model");
const trainingPhrase_1 = require("../utils/trainingPhrase");
const run = async () => {
    await mongoose_1.default.connect(env_1.env.mongoUri);
    const report = {
        found: 0,
        corrected: 0,
        failed: 0,
    };
    const catalog = await contentCatalog_model_1.ContentCatalogModel.findOne({ key: "shadowingItems" });
    if (!catalog) {
        console.log("TRAINING_PHRASE_BACKFILL_REPORT", report);
        await mongoose_1.default.disconnect();
        return;
    }
    const seedById = new Map(seedData_1.dashboardSeed.shadowingItems.map((item) => [item.id, item]));
    const seedByText = new Map(seedData_1.dashboardSeed.shadowingItems.map((item) => [item.text, item]));
    const nextItems = [];
    let changed = false;
    for (const item of catalog.items ?? []) {
        report.found += 1;
        const record = item;
        const text = typeof record.text === "string" ? record.text : record.phrase;
        const fallback = seedById.get(record.id) ?? seedByText.get(text);
        const normalized = (0, trainingPhrase_1.normalizeShadowingItem)(record, fallback);
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
    await mongoose_1.default.disconnect();
};
run().catch(async (error) => {
    console.error("TRAINING_PHRASE_INVALID_PAYLOAD", {
        message: error instanceof Error ? error.message : "Unknown backfill error",
    });
    await mongoose_1.default.disconnect().catch(() => null);
    process.exitCode = 1;
});
