"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
class SettingsService {
    constructor(settingsRepository) {
        this.settingsRepository = settingsRepository;
    }
    getSettings(userId) {
        return this.settingsRepository.findOrCreate(userId);
    }
    updateSettings(userId, input) {
        return this.settingsRepository.update(userId, input);
    }
}
exports.SettingsService = SettingsService;
