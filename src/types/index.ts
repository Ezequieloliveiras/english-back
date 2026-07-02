export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export type StudyBlockType =
  | "shadowing"
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
}

export interface ListeningQuestion {
  id: string;
  prompt: string;
  answer: string;
}

export interface ListeningLesson {
  id: string;
  title: string;
  level: EnglishLevel;
  dialogue: string[];
  questions: ListeningQuestion[];
}

export interface ShadowingItem {
  id: string;
  phrase: string;
  pronunciationHint: string;
  audioUrl?: string;
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
  goal: UserGoal;
  progress: ProgressSnapshot;
  dailyPlan: DailyPlan;
  vocabulary: VocabularyItem[];
  listeningLessons: ListeningLesson[];
  shadowingItems: ShadowingItem[];
  conversationModes: ConversationMode[];
  developerModes: ConversationMode[];
  thinkInEnglishPrompts: ThinkInEnglishPrompt[];
}
