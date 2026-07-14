import { describe, expect, test } from "@jest/globals";
import { buildAudioCacheKey } from "../utils/audioCache";

const baseAudioKeyInput = {
  provider: "openai",
  model: "gpt-4o-mini-tts",
  text: "I need a few more minutes.",
  voice: "alloy",
  speed: 1,
  accent: "american",
  language: "en-US",
  audioType: "training_phrase" as const,
  version: "prefs-v1",
};

describe("audio cache key", () => {
  test("changes when voice changes", () => {
    expect(buildAudioCacheKey(baseAudioKeyInput)).not.toBe(
      buildAudioCacheKey({ ...baseAudioKeyInput, voice: "nova" })
    );
  });

  test("changes when accent changes", () => {
    expect(buildAudioCacheKey(baseAudioKeyInput)).not.toBe(
      buildAudioCacheKey({ ...baseAudioKeyInput, accent: "british", language: "en-GB" })
    );
  });

  test("normalizes whitespace without changing the cache key", () => {
    expect(buildAudioCacheKey(baseAudioKeyInput)).toBe(
      buildAudioCacheKey({ ...baseAudioKeyInput, text: "  I need   a few more minutes. " })
    );
  });
});
