import { describe, expect, it } from "@jest/globals";
import { assertPortugueseTrainingPhrase, normalizeShadowingItem } from "../utils/trainingPhrase";

describe("training phrase normalization", () => {
  it("returns the official contract for a valid phrase", () => {
    const item = normalizeShadowingItem({
      id: "phrase-1",
      text: "I am looking into the issue.",
      translation: "Estou analisando o problema.",
      explanation: "Use para dizer que você está verificando um problema.",
      chunks: [{ text: "I am looking into", translation: "Estou analisando" }],
      pronunciationTip: "Conecte looking into.",
    });

    expect(item).toMatchObject({
      id: "phrase-1",
      text: "I am looking into the issue.",
      translation: "Estou analisando o problema.",
      explanation: "Use para dizer que você está verificando um problema.",
      language: "en",
      translationLanguage: "pt-BR",
    });
    expect(item?.chunks).toEqual([{ text: "I am looking into", translation: "Estou analisando" }]);
  });

  it("normalizes legacy translationPt and chunk meaning fields", () => {
    const item = normalizeShadowingItem({
      id: "legacy-1",
      phrase: "Could you walk me through the next steps?",
      translationPt: "Você poderia me explicar os próximos passos?",
      chunks: [{ text: "walk me through", meaning: "me explicar passo a passo" }],
      pronunciationHint: "Reduce could you.",
    });

    expect(item?.text).toBe("Could you walk me through the next steps?");
    expect(item?.translation).toBe("Você poderia me explicar os próximos passos?");
    expect(item?.chunks).toEqual([{ text: "walk me through", translation: "me explicar passo a passo" }]);
  });

  it("keeps translation null for null or empty translation values", () => {
    const nullTranslation = normalizeShadowingItem({ id: "null", text: "Hello.", translation: null });
    const emptyTranslation = normalizeShadowingItem({ id: "empty", text: "Hello.", translation: "   " });

    expect(nullTranslation?.translation).toBeNull();
    expect(emptyTranslation?.translation).toBeNull();
    expect(assertPortugueseTrainingPhrase(nullTranslation!)).toBe(false);
    expect(assertPortugueseTrainingPhrase(emptyTranslation!)).toBe(false);
  });
});
