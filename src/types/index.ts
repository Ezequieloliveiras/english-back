export type CEFRLevel =
  | "A1.1"
  | "A1.2"
  | "A2.1"
  | "A2.2"
  | "B1.1"
  | "B1.2"
  | "B2.1"
  | "B2.2";

export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | CEFRLevel;

export type CompetencyCategory =
  | "listening"
  | "speaking"
  | "pronunciation"
  | "vocabulary"
  | "interaction"
  | "fluency"
  | "reading"
  | "writing"
  | "thinking_in_english";

export interface CEFRLevelDefinition {
  code: CEFRLevel;
  title: string;
  description: string;
  sequence: number;
  objectives: string[];
  requiredCompetencies: string[];
  completionCriteria: string[];
  isActive: boolean;
  pedagogy: {
    cefrBand: "A1" | "A2" | "B1" | "B2";
    estimatedHours: string;
    grammarFocus: string[];
    vocabularyTarget: string;
    realWorldSituations: string[];
  };
}

export interface Competency {
  id: string;
  code: string;
  level: CEFRLevel;
  title: string;
  description: string;
  category: CompetencyCategory;
  canDoStatement: string;
  requiredScore: number;
  requiredRetentionScore: number;
  requiredAttempts: number;
  prerequisites: string[];
  tags: string[];
}

export interface LearningUnit {
  id: string;
  level: CEFRLevel;
  title: string;
  description: string;
  scenario: string;
  competencies: string[];
  grammarFocus: string[];
  vocabularyChunks: string[];
  listeningContentIds: string[];
  pronunciationContentIds: string[];
  speakingContentIds: string[];
  thinkingContentIds: string[];
  reviewContentIds: string[];
  estimatedMinutes: number;
  order: number;
  status: "draft" | "published" | "archived";
}

export interface CompetencyEvidence {
  type:
    | "listening_attempt"
    | "speaking_attempt"
    | "pronunciation_analysis"
    | "vocabulary_recall"
    | "conversation_task"
    | "checkpoint"
    | "retention_review"
    | "practice_completion";
  score: number;
  createdAt: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface CompetencyProgress {
  userId: string;
  competencyId: string;
  masteryScore: number;
  retentionScore: number;
  confidenceScore: number;
  attempts: number;
  successfulAttempts: number;
  lastPracticedAt: string | null;
  lastAssessedAt: string | null;
  masteredAt: string | null;
  status: "locked" | "learning" | "reviewing" | "mastered";
  evidence: CompetencyEvidence[];
}

export interface UserLevelProgress {
  userId: string;
  currentLevel: CEFRLevel;
  targetLevel: CEFRLevel;
  levelProgress: number;
  competenciesMastered: number;
  competenciesRequired: number;
  checkpointStatus: "locked" | "available" | "in_progress" | "passed" | "failed";
  startedAt: string;
  completedAt: string | null;
}

export interface CompetencyProfile {
  userId: string;
  listening: number;
  speaking: number;
  pronunciation: number;
  vocabulary: number;
  interaction: number;
  fluency: number;
  retention: number;
  thinkingInEnglish: number;
  updatedAt: string;
}

export interface DailyExercise {
  id: string;
  type: StudyBlockType;
  title: string;
  estimatedMinutes: number;
  competencyIds: string[];
  contentIds: string[];
}

export interface DailyLearningContext {
  userId: string;
  date: string;
  learningUnitId: string;
  targetCompetencies: string[];
  targetChunks: string[];
  scenario: string;
  exercises: DailyExercise[];
  totalEstimatedMinutes: number;
  completedMinutes: number;
  completionPercentage: number;
}

export interface CheckpointDefinition {
  id: string;
  level: CEFRLevel;
  title: string;
  description: string;
  requiredCompetencies: string[];
  tasks: string[];
  minimumScores: {
    listening: number;
    speaking: number;
    vocabulary: number;
    retention: number;
    checkpoint: number;
  };
}

export interface LearningRoadmapPayload {
  levels: CEFRLevelDefinition[];
  competencies: Competency[];
  units: LearningUnit[];
  checkpoints: CheckpointDefinition[];
}

export type StudyBlockType =
  | "shadowing"
  | "speaking-coach"
  | "listening"
  | "vocabulary"
  | "conversation"
  | "review";

export type StudyStatus =
  | "pending"
  | "not_started"
  | "in_progress"
  | "completed"
  | "review_pending"
  | "blocked";

export type DailyPlanStepStatus = "not_started" | "in_progress" | "completed";

export interface DailyPlanStep {
  id: string;
  label: string;
  status: DailyPlanStepStatus;
  required: boolean;
  completedAt?: string | null;
  evidenceType?: string;
  evidenceRef?: string;
}

export interface StudyBlock {
  id: string;
  title: string;
  type: StudyBlockType;
  durationMinutes: number;
  status: StudyStatus;
  progress: number;
  objective: string;
  requiredSteps?: DailyPlanStep[];
  completedSteps?: number;
  totalSteps?: number;
  progressPercentage?: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface DailyPlan {
  id: string;
  userId: string;
  focus: string;
  totalMinutes: number;
  streak: number;
  date: string;
  status?: "not_started" | "in_progress" | "completed";
  completedAt?: string | null;
  learningUnitId?: string;
  scenario?: string;
  targetCompetencies?: string[];
  targetChunks?: string[];
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
