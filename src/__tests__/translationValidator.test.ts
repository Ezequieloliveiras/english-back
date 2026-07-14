import { describe, expect, test } from "@jest/globals";
import {
  TranslationValidationError,
  validatePortugueseTranslation,
} from "../utils/translationValidator";

describe("translation validator", () => {
  test("accepts a Brazilian Portuguese translation", () => {
    expect(validatePortugueseTranslation("I need a few more minutes.", "Eu preciso de mais alguns minutos.")).toEqual({
      valid: true,
    });
  });

  test("rejects empty, copied and mostly English translations", () => {
    expect(validatePortugueseTranslation("Good morning.", "")).toEqual(
      expect.objectContaining({ valid: false, reason: "missing_translation" })
    );
    expect(validatePortugueseTranslation("Good morning.", "Good morning.")).toEqual(
      expect.objectContaining({ valid: false, reason: "same_as_source" })
    );
    expect(validatePortugueseTranslation("I need more time.", "You need to have this please.")).toEqual(
      expect.objectContaining({ valid: false, reason: "mostly_english" })
    );
  });

  test("exposes a typed error for invalid translations", () => {
    const result = validatePortugueseTranslation("I need more time.", "You need to have this please.");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      const error = new TranslationValidationError(result.reason ?? "invalid_payload", "Invalid translation");
      expect(error).toBeInstanceOf(Error);
      expect(error.reason).toBe("mostly_english");
    }
  });
});
