"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const database_1 = require("./config/database");
const env_1 = require("./config/env");
const start = async () => {
    await (0, database_1.connectDatabase)();
    app_1.app.listen(env_1.env.port, () => {
        console.log(`English OS API running on port ${env_1.env.port}`);
    });
};
void start();
