"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
class SettingsController {
    constructor(settingsService) {
        this.settingsService = settingsService;
        this.get = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const settings = await this.settingsService.getSettings(request.auth.userId);
            response.json({ settings });
        };
        this.update = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const settings = await this.settingsService.updateSettings(request.auth.userId, request.body);
            response.json({ settings });
        };
    }
}
exports.SettingsController = SettingsController;
