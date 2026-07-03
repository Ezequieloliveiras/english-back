import {
  ConversationMode,
  DashboardPayload,
  ListeningLesson,
  ShadowingItem,
  ThinkInEnglishPrompt,
  VocabularyItem,
} from "../types";

const conversationModes: ConversationMode[] = [
  {
    id: "job-interview",
    title: "Job Interview",
    description: "Practice concise answers about your experience and goals.",
    audience: "general",
    starter: "Tell me about yourself and why you want this role.",
  },
  {
    id: "work-meeting",
    title: "Work Meeting",
    description: "Navigate updates, blockers, and decision making in English.",
    audience: "general",
    starter: "Can you share the current status of your tasks?",
  },
  {
    id: "restaurant",
    title: "Restaurant",
    description: "Order naturally, ask for changes, and solve small issues.",
    audience: "general",
    starter: "Welcome. Are you ready to order?",
  },
  {
    id: "travel",
    title: "Travel",
    description: "Train survival English for airport, hotel, and transport.",
    audience: "general",
    starter: "Good afternoon. May I see your passport, please?",
  },
  {
    id: "casual-conversation",
    title: "Casual Conversation",
    description: "Build fluency for daily life and informal interactions.",
    audience: "general",
    starter: "What did you do this week that made you feel proud?",
  },
  {
    id: "technical-scenario",
    title: "Technical Scenario",
    description: "Explain technical context with simple but natural English.",
    audience: "general",
    starter: "The API is slow in production. How would you explain the issue?",
  },
];

const developerModes: ConversationMode[] = [
  {
    id: "explaining-bugs",
    title: "Explaining Bugs",
    description: "Describe symptoms, impact, and reproduction steps clearly.",
    audience: "developer",
    starter: "What bug are you working on right now?",
  },
  {
    id: "talking-about-apis",
    title: "Talking About APIs",
    description: "Discuss endpoints, contracts, payloads, and failures.",
    audience: "developer",
    starter: "How would you explain this endpoint to a frontend teammate?",
  },
  {
    id: "deploy-issues",
    title: "Deploy Issues",
    description: "Handle infra setbacks and production incidents with calm language.",
    audience: "developer",
    starter: "The latest deploy failed. What happened?",
  },
  {
    id: "database-problems",
    title: "Database Problems",
    description: "Talk about queries, indexing, and data integrity issues.",
    audience: "developer",
    starter: "Why is this query taking so long?",
  },
  {
    id: "pull-requests",
    title: "Pull Requests",
    description: "Present tradeoffs and request reviews with confidence.",
    audience: "developer",
    starter: "What changed in your pull request?",
  },
  {
    id: "sprint-meeting",
    title: "Sprint Meeting",
    description: "Share progress, blockers, and next steps in standups.",
    audience: "developer",
    starter: "What did you finish yesterday and what is next today?",
  },
  {
    id: "client-support",
    title: "Client Support",
    description: "Explain technical issues in simpler English for clients.",
    audience: "developer",
    starter: "How would you explain this outage to the client?",
  },
  {
    id: "backend-frontend-tasks",
    title: "Backend/Frontend Tasks",
    description: "Describe implementation work across the stack.",
    audience: "developer",
    starter: "How are you splitting this feature between backend and frontend?",
  },
];

const vocabulary: VocabularyItem[] = [
  {
    id: "v1",
    phrase: "I need a few more minutes to finish this task.",
    translation: "Eu preciso de mais alguns minutos para terminar esta tarefa.",
    level: "A2",
    category: "Work",
    sentences: [
      { text: "I need a few more minutes to finish this task." },
      { text: "I can send the update after lunch." },
      { text: "This part is almost done." },
    ],
    confidence: 68,
    nextReviewAt: "2026-07-05T09:00:00.000Z",
    hits: 2,
    misses: 1,
  },
  {
    id: "v2",
    phrase: "Could you say that one more time, please?",
    translation: "Você poderia dizer isso mais uma vez, por favor?",
    level: "A1",
    category: "Conversation",
    sentences: [
      { text: "Could you say that one more time, please?" },
      { text: "I did not catch the last part." },
      { text: "Please speak a little slower." },
    ],
    confidence: 82,
    nextReviewAt: "2026-07-03T09:00:00.000Z",
    hits: 3,
    misses: 0,
  },
  {
    id: "v3",
    phrase: "The issue happens when the user refreshes the page.",
    translation: "O problema acontece quando o usuário atualiza a página.",
    level: "B1",
    category: "Developer",
    sentences: [
      { text: "The issue happens when the user refreshes the page." },
      { text: "We could not reproduce it locally." },
      { text: "The logs show a timeout in production." },
    ],
    confidence: 44,
    nextReviewAt: "2026-07-03T13:00:00.000Z",
    hits: 1,
    misses: 2,
  },
];

const listeningLessons: ListeningLesson[] = [
  {
    id: "l1",
    title: "Morning Standup",
    level: "A2",
    dialogue: [
      "Anna: Good morning. What are you working on today?",
      "Leo: I am fixing the login flow and writing two tests.",
      "Anna: Do you have any blockers?",
      "Leo: Yes, I need access to the staging logs.",
    ],
    questions: [
      { id: "q1", prompt: "What is Leo working on?", answer: "The login flow and two tests." },
      { id: "q2", prompt: "What blocker does Leo have?", answer: "He needs access to the staging logs." },
    ],
  },
  {
    id: "l2",
    title: "At the Airport",
    level: "A1",
    dialogue: [
      "Agent: Where are you flying today?",
      "Passenger: I am going to Toronto for a conference.",
      "Agent: Do you have any bags to check?",
      "Passenger: Yes, just one suitcase.",
    ],
    questions: [
      { id: "q3", prompt: "Where is the passenger going?", answer: "Toronto." },
      { id: "q4", prompt: "How many bags will be checked?", answer: "One suitcase." },
    ],
  },
];

const shadowingItems: ShadowingItem[] = [
  {
    id: "s1",
    phrase: "I am looking into the issue and I will update you soon.",
    pronunciationHint: "Link 'looking into' smoothly and stress 'update'.",
  },
  {
    id: "s2",
    phrase: "We can ship the fix today if the tests pass.",
    pronunciationHint: "Keep 'can ship the fix' as one rhythm group.",
  },
  {
    id: "s3",
    phrase: "Could you walk me through the next steps?",
    pronunciationHint: "Reduce 'could you' to sound more natural.",
  },
];

const thinkInEnglishPrompts: ThinkInEnglishPrompt[] = [
  {
    id: "t1",
    userMessage: "Como fala cadeira?",
    coachReply: "Describe it in English. What do you use it for at home or at work?",
  },
  {
    id: "t2",
    userMessage: "Como fala atrasado?",
    coachReply: "Try a situation first: are you late for a meeting, a flight, or a delivery?",
  },
  {
    id: "t3",
    userMessage: "Esqueci a palavra para tomada.",
    coachReply: "Describe where it is and what you connect to it. Build the idea before the word.",
  },
];

export const dashboardSeed: DashboardPayload = {
  user: {
    id: "seed-user-template",
    name: "Alex",
    email: "alex@example.com",
    currentLevel: "A2",
    dailyMinutes: 32,
    profession: "Full Stack Developer",
    primaryGoal: "Speak naturally in meetings and technical conversations",
    mainDifficulty: "speaking",
  },
  goal: {
    id: "goal-1",
    label: "Reach confident B1 speaking for work",
    targetLevel: "B1",
    progress: 0,
  },
  progress: {
    level: "A2",
    speakingScore: 0,
    listeningScore: 0,
    vocabularyScore: 0,
    pronunciationScore: 0,
    consistencyScore: 0,
    studiedMinutesToday: 0,
    streakDays: 0,
  },
  dailyPlan: {
    id: "plan-1",
    userId: "seed-user-template",
    focus: "Confidence for work conversations",
    totalMinutes: 32,
    streak: 0,
    date: "2026-07-02",
    blocks: [
      {
        id: "b1",
        title: "Shadowing",
        type: "shadowing",
        durationMinutes: 8,
        status: "pending",
        progress: 0,
        objective: "Repeat useful work phrases with rhythm and confidence.",
      },
      {
        id: "b2",
        title: "Listening",
        type: "listening",
        durationMinutes: 6,
        status: "pending",
        progress: 0,
        objective: "Understand a short standup conversation without translating.",
      },
      {
        id: "b3",
        title: "Vocabulary",
        type: "vocabulary",
        durationMinutes: 5,
        status: "pending",
        progress: 0,
        objective: "Mine full sentences you can reuse today.",
      },
      {
        id: "b4",
        title: "Conversation",
        type: "conversation",
        durationMinutes: 8,
        status: "pending",
        progress: 0,
        objective: "Practice answering naturally in a technical scenario.",
      },
      {
        id: "b5",
        title: "Review",
        type: "review",
        durationMinutes: 5,
        status: "pending",
        progress: 0,
        objective: "Review weak phrases scheduled by spaced repetition.",
      },
    ],
  },
  vocabulary,
  listeningLessons,
  shadowingItems,
  conversationModes,
  developerModes,
  thinkInEnglishPrompts,
};
