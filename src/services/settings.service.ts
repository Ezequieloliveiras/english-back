import { SettingsRepository, UserSettings } from "../repositories/settings.repository";

export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  getSettings(userId: string) {
    return this.settingsRepository.findOrCreate(userId);
  }

  updateSettings(userId: string, input: Partial<UserSettings>) {
    return this.settingsRepository.update(userId, input);
  }
}
