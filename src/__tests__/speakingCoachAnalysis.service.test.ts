import { describe, expect, test } from "@jest/globals";
import {
  buildSpeechAnalysisResult,
  comparePhraseToTranscript,
} from "../services/speakingCoachAnalysis.service";

describe("speech analysis result", () => {
  test("preserves raw douctor transcript while correcting expected doctor", () => {
    const comparison = comparePhraseToTranscript("doctor", "douctor");
    const result = buildSpeechAnalysisResult({
      rawTranscript: "douctor",
      expectedText: "doctor",
      targetLanguage: "en-US",
      transcriptionLanguage: "en",
      comparison,
      alignment: [
        {
          expectedWord: "doctor",
          spokenWord: "douctor",
          status: "substitution",
        },
      ],
    });

    expect(result.rawTranscript).toBe("douctor");
    expect(result.normalizedTranscript).toBe("douctor");
    expect(result.expectedText).toBe("doctor");
    expect(result.correctedText).toBe("doctor");
    expect(result.translated).toBe(false);
    expect(result.isCorrect).toBe(false);
    expect(result.wordAnalysis).toEqual([
      expect.objectContaining({
        expected: "doctor",
        spoken: "douctor",
        status: "mispronounced",
      }),
    ]);
  });

  test("marks exact doctor attempt as correct without correctedText", () => {
    const comparison = comparePhraseToTranscript("doctor", "doctor");
    const result = buildSpeechAnalysisResult({
      rawTranscript: "doctor",
      expectedText: "doctor",
      targetLanguage: "en-US",
      transcriptionLanguage: "en",
      comparison,
      alignment: [
        {
          expectedWord: "doctor",
          spokenWord: "doctor",
          status: "exact",
        },
      ],
    });

    expect(result.isCorrect).toBe(true);
    expect(result.correctedText).toBeUndefined();
    expect(result.wordAnalysis[0]).toEqual(
      expect.objectContaining({
        expected: "doctor",
        spoken: "doctor",
        status: "correct",
      })
    );
  });
});
