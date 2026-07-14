export type WordAnalysisStatus = "correct" | "mispronounced" | "missing" | "extra";

export interface WordAnalysis {
  spoken: string;
  expected: string;
  status: WordAnalysisStatus;
  explanationPtBr?: string;
  start?: number;
  end?: number;
  confidence?: number;
}

export interface SpeechAnalysisResult {
  rawTranscript: string;
  normalizedTranscript: string;
  expectedText: string;
  correctedText?: string;
  translationPtBr?: string;
  feedbackPtBr?: string;
  detectedLanguage?: string;
  targetLanguage: string;
  transcriptionLanguage: string;
  translated: boolean;
  isCorrect: boolean;
  confidence?: number;
  wordAnalysis: WordAnalysis[];
}
