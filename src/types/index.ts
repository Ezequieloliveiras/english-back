export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export type StudyBlockType =
  | "shadowing"
  | "speaking-coach"
  | "listening"
  | "vocabulary"
  | "conversation"
  | "review";

export type StudyStatus = "pending" | "in_progress" | "completed";

export interface StudyBlock {
  id: string;
  title: string;
  type: StudyBlockType;
  durationMinutes: number;
  status: StudyStatus;
  progress: number;
  objective: string;
}

export interface DailyPlan {
  id: string;
  userId: string;
  focus: string;
  totalMinutes: number;
  streak: number;
  date: string;
  blocks: StudyBlock[];
}

export interface UserGoal {
  id: string;
  label: string;
  targetLevel: EnglishLevel;
  progress: number;
}

export interface ProgressSnapshot {
  level: EnglishLevel;
  speakingScore: number;
  listeningScore: number;
  vocabularyScore: number;
  pronunciationScore: number;
  consistencyScore: number;
  studiedMinutesToday: number;
  streakDays: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  currentLevel: EnglishLevel;
  dailyMinutes: number;
  profession: string;
  primaryGoal: string;
  mainDifficulty: "listening" | "speaking" | "vocabulary" | "pronunciation";
}

export interface UserSettings {
  userId: string;
  languageMode: "pt_explanation_en_correction" | "full_english";
  supportLanguageMode:
    | "full_portuguese_support"
    | "moderate_support"
    | "guided_immersion"
    | "english_only";
  preferredAccent: "american" | "british" | "neutral";
  preferredVoice:
    | "alloy"
    | "ash"
    | "ballad"
    | "coral"
    | "echo"
    | "fable"
    | "nova"
    | "onyx"
    | "sage"
    | "shimmer"
    | "verse"
    | "marin"
    | "cedar";
  correctionStyle: "gentle" | "direct" | "detailed";
  interfaceLanguage: "pt-BR" | "en";
  primaryObjective: "conversation" | "interview" | "work" | "travel" | "technical_english";
  dailyMinutes: number;
}

export interface UserProgressStats {
  totalWordsPronounced: number;
  totalPhrasesPracticed: number;
  totalSpeakingSessions: number;
  totalStudyMinutes: number;
  totalRecordings: number;
  totalCorrections: number;
  currentStreak: number;
  lastStudyDate?: string;
  mainImprovementArea: string;
  mostPracticedWords: string[];
  mostMissedWords: string[];
  weeklySpeaking: Array<{
    dateLabel: string;
    score: number;
  }>;
}

export interface RecentSpeakingAttempt {
  id: string;
  expectedText: string;
  transcribedText: string;
  pronunciationScore: number;
  naturalnessScore: number;
  connectedSpeechScore: number;
  wordsSpokenCount: number;
  correctedWords: string[];
  suggestion?: string;
  createdAt?: string;
}

export interface VocabularySentence {
  text: string;
  translation?: string;
}

export interface VocabularyItem {
  id: string;
  phrase: string;
  translation?: string;
  level: EnglishLevel;
  category: string;
  sentences: VocabularySentence[];
  confidence: number;
  nextReviewAt: string;
  hits: number;
  misses: number;
  source?: string;
  timesPracticed?: number;
  timesCorrect?: number;
  timesWrong?: number;
}

export interface ListeningQuestion {
  id: string;
  prompt: string;
  answer: string;
}

export interface PhraseMeaningChunk {
  text: string;
  meaning: string;
}

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface ComprehensiblePhraseDetails {
  sourceText?: string;
  audioUrl?: string;
  naturalTranslation?: string;
  translation?: string;
  translatedText?: string;
  translationPtBr?: string;
  portugueseText?: string;
  words?: TimedWord[];
  chunks?: PhraseMeaningChunk[];
  context?: string;
  importantWords?: Array<{
    text: string;
    meaning: string;
  }>;
  pronunciationTip?: string;
  additionalExample?: string;
  slowPrompt?: string;
}

export interface ListeningLesson {
  id: string;
  title: string;
  level: EnglishLevel;
  imageUrl?: string;
  imageSource?: "generated" | "library" | "external";
  imageAlt?: string;
  situationDescription?: string;
  dialogue: string[];
  questions: ListeningQuestion[];
  comprehension?: ComprehensiblePhraseDetails[];
}

export interface ShadowingItem {
  id: string;
  phrase: string;
  pronunciationHint: string;
  audioUrl?: string;
  naturalTranslation?: string;
  chunks?: PhraseMeaningChunk[];
  context?: string;
  importantWords?: Array<{
    text: string;
    meaning: string;
  }>;
  pronunciationTip?: string;
  additionalExample?: string;
  slowPrompt?: string;
}

export interface ConversationMode {
  id: string;
  title: string;
  description: string;
  audience: "general" | "developer";
  starter: string;
}

export interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
  correction?: string;
}

export interface ConversationSession {
  id: string;
  modeId: string;
  title: string;
  messages: ConversationMessage[];
}

export interface ThinkInEnglishPrompt {
  id: string;
  userMessage: string;
  coachReply: string;
}

export interface DashboardPayload {
  user: UserProfile;
  settings: UserSettings;
  goal: UserGoal;
  progress: ProgressSnapshot;
  realProgressStats: UserProgressStats;
  recentSpeakingAttempts: RecentSpeakingAttempt[];
  dailyPlan: DailyPlan;
  vocabulary: VocabularyItem[];
  reviewQueue: VocabularyItem[];
  listeningLessons: ListeningLesson[];
  shadowingItems: ShadowingItem[];
  conversationModes: ConversationMode[];
  developerModes: ConversationMode[];
  thinkInEnglishPrompts: ThinkInEnglishPrompt[];
}
