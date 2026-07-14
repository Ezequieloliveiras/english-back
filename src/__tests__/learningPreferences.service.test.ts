import { describe, expect, test } from "@jest/globals";
import { SettingsRepository } from "../repositories/settings.repository";
import {
  LearningPreferencesService,
  resolveEffectiveLearningPreferences,
} from "../services/learningPreferences.service";

describe("learning preferences", () => {
  test("preserves explicit interfaceLanguage when languageMode also changes", async () => {
    const repository = new SettingsRepository();

    const settings = await repository.update("user-interface", {
      languageMode: "full_english",
      interfaceLanguage: "pt-BR",
    });

    expect(settings.languageMode).toBe("full_english");
    expect(settings.interfaceLanguage).toBe("pt-BR");
  });

  test("keeps legacy languageMode fallback when interfaceLanguage is omitted", async () => {
    const repository = new SettingsRepository();

    const settings = await repository.update("user-legacy", {
      languageMode: "full_english",
    });

    expect(settings.interfaceLanguage).toBe("en");
  });

  test("resolves neutral accent to an effective American target language", () => {
    const preferences = resolveEffectiveLearningPreferences({
      userId: "user-neutral",
      preferredAccent: "neutral",
      preferredVoice: "nova",
    });

    expect(preferences.accent).toBe("american");
    expect(preferences.targetLanguage).toBe("en-US");
    expect(preferences.voice).toBe("nova");
    expect(preferences.transcriptionLanguage).toBe("en");
  });

  test("service exposes a single effective preferences object", async () => {
    const repository = new SettingsRepository();
    await repository.update("user-british", {
      preferredAccent: "british",
      supportLanguageMode: "guided_immersion",
    });

    const service = new LearningPreferencesService(repository);
    const preferences = await service.getEffectivePreferences("user-british");

    expect(preferences.accent).toBe("british");
    expect(preferences.targetLanguage).toBe("en-GB");
    expect(preferences.portugueseSupportLevel).toBe("moderate");
  });
});
