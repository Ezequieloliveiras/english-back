"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentCatalogModel = void 0;
const mongoose_1 = require("mongoose");
const contentCatalogSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    items: { type: [mongoose_1.Schema.Types.Mixed], required: true, default: [] },
}, { timestamps: true });
exports.ContentCatalogModel = (0, mongoose_1.model)("ContentCatalog", contentCatalogSchema);
