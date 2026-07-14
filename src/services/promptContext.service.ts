import { EffectiveLearningPreferences, buildGenerationContext } from "./learningPreferences.service";

export const PROMPT_CONTEXT_VERSION = 2;

const supportInstruction = (preferences: EffectiveLearningPreferences) => {
  if (preferences.portugueseSupportLevel === "none" || preferences.interfaceLanguage === "en") {
    return "Use simple English for explanations. Do not include Portuguese support unless the user explicitly asks.";
  }

  if (preferences.portugueseSupportLevel === "full") {
    return "Explain pedagogy, feedback, instructions and reasoning in Brazilian Portuguese. Keep studied English phrases, corrections and examples in English.";
  }

  return "Use Brazilian Portuguese for concise pedagogical support when helpful. Keep studied English phrases, corrections and examples in English.";
};

export class PromptContextBuilder {
  static build(preferences: EffectiveLearningPreferences, promptVersion = PROMPT_CONTEXT_VERSION) {
    const context = buildGenerationContext(preferences, promptVersion);

    return `
Prompt context JSON:
${JSON.stringify({
  ...context,
  transcriptionLanguage: preferences.transcriptionLanguage,
  supportLanguage: preferences.supportLanguage,
  languageMode: preferences.languageMode,
  supportLanguageMode: preferences.supportLanguageMode,
  voice: preferences.voice,
  primaryObjective: preferences.primaryObjective,
})}
Rules:
- Interface text and pedagogical explanations follow interfaceLanguage and portugueseSupportLevel.
- The studied language is English (${preferences.targetLanguage}); training phrases, expected answers and examples stay in English.
- Never translate a speech transcript field. Keep raw speech/transcription separate from expected, corrected and translated text.
- Never overwrite the original spoken/transcribed text with the expected phrase.
- Respect correctionStyle (${preferences.correctionStyle}) and preferred accent (${preferences.accent}).
- Return valid structured JSON exactly in the requested shape.
- Do not invent phonetic or acoustic evidence when confidence is insufficient.
${supportInstruction(preferences)}
`.trim();
  }
}
