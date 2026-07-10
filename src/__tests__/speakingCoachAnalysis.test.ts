import { describe, expect, it } from "@jest/globals";
import {
  analyzePcmWav,
  comparePhraseToTranscript,
  deriveSpeakingMetrics,
  isSupportedSpeakingAudioMime,
  validateTranscriptComparison,
} from "../services/speakingCoachAnalysis.service";

const makeWav = (samples: Int16Array, sampleRate = 16000) => {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(sample, 44 + index * 2));
  return buffer;
};

describe("speaking coach deterministic analysis", () => {
  it("detects silent PCM as no speech", () => {
    const quality = analyzePcmWav(makeWav(new Int16Array(16000)));

    expect(quality.hasSpeech).toBe(false);
    expect(quality.rms).toBe(0);
    expect(quality.speechRatio).toBe(0);
  });

  it("compares exact and partial phrases", () => {
    const exact = comparePhraseToTranscript("I want to talk about my routine.", "I wanna talk about my routine");
    const partial = comparePhraseToTranscript("I want to talk about my routine.", "I want routine");

    expect(exact.coverage).toBe(1);
    expect(exact.similarity).toBe(1);
    expect(partial.coverage).toBeLessThan(0.6);
    expect(partial.missingWords).toContain("talk");
  });

  it("rejects a totally different phrase", () => {
    const comparison = comparePhraseToTranscript("I want to talk about my routine.", "The weather is nice today");

    expect(() =>
      validateTranscriptComparison(
        "The weather is nice today",
        {
          durationSeconds: 2,
          rms: 0.04,
          peak: 0.2,
          speechSeconds: 1.5,
          speechRatio: 0.75,
          silenceRatio: 0.25,
          hasSpeech: true,
        },
        comparison
      )
    ).toThrow("A gravação não corresponde");
  });

  it("rejects filler sounds instead of the English target phrase", () => {
    const comparison = comparePhraseToTranscript("I want to talk about my routine.", "bla bla bla");

    expect(() =>
      validateTranscriptComparison(
        "bla bla bla",
        {
          durationSeconds: 2,
          rms: 0.04,
          peak: 0.2,
          speechSeconds: 1.5,
          speechRatio: 0.75,
          silenceRatio: 0.25,
          hasSpeech: true,
        },
        comparison
      )
    ).toThrow("A gravação não corresponde");
  });

  it("caps scores for low coverage and keeps metrics in 0-10", () => {
    const comparison = comparePhraseToTranscript("I want to talk about my routine.", "routine");
    const result = deriveSpeakingMetrics(
      {
        durationSeconds: 2,
        rms: 0.04,
        peak: 0.2,
        speechSeconds: 1.5,
        speechRatio: 0.75,
        silenceRatio: 0.25,
        hasSpeech: true,
      },
      comparison
    );

    expect(result.overallScore).toBeLessThanOrEqual(3);
    result.metrics.forEach((metric) => {
      expect(metric.value).toBeGreaterThanOrEqual(0);
      expect(metric.value).toBeLessThanOrEqual(10);
    });
  });

  it("validates supported upload MIME types", () => {
    expect(isSupportedSpeakingAudioMime("audio/webm")).toBe(true);
    expect(isSupportedSpeakingAudioMime("audio/wav")).toBe(true);
    expect(isSupportedSpeakingAudioMime("text/plain")).toBe(false);
  });
});
