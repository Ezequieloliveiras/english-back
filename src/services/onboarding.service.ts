import { DailyPlanService } from "./dailyPlan.service";
import { EnglishLevel, UserProfile } from "../types";

interface OnboardingInput {
  name: string;
  objective: string;
  level: EnglishLevel;
  dailyMinutes: number;
  profession: string;
  professionalFocusMode?: UserProfile["professionalFocusMode"];
  difficulty: UserProfile["mainDifficulty"];
}

const normalizeProfessionText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const illegalProfessionTerms = [
  "trafico",
  "traficante",
  "drug dealer",
  "dealer",
  "cartel",
  "lavagem",
  "money laundering",
  "golpe",
  "scam",
  "fraude",
  "fraud",
  "black hat",
  "phishing",
  "ransomware",
  "hitman",
  "contrabando",
];

const recognizedProfessionTerms = [
  "marketing",
  "growth",
  "social media",
  "copywriter",
  "designer",
  "product",
  "produto",
  "developer",
  "desenvolvedor",
  "programador",
  "engenheiro",
  "engineer",
  "data",
  "analyst",
  "analista",
  "sales",
  "vendas",
  "customer success",
  "support",
  "suporte",
  "teacher",
  "professor",
  "lawyer",
  "advogado",
  "doctor",
  "medico",
  "nurse",
  "enfermeiro",
  "finance",
  "financas",
  "accounting",
  "contabilidade",
  "hr",
  "rh",
  "recruiter",
  "recrutador",
  "operations",
  "operacoes",
  "project manager",
  "manager",
  "gerente",
  "consultant",
  "consultor",
  "entrepreneur",
  "empreendedor",
  "student",
  "estudante",
  "architect",
  "arquiteto",
  "real estate",
  "imobiliario",
  "chef",
  "logistics",
  "logistica",
  "quality",
  "qualidade",
];

const professionalRoleTerms = [
  "manager",
  "gerente",
  "analyst",
  "analista",
  "assistant",
  "assistente",
  "coordinator",
  "coordenador",
  "specialist",
  "especialista",
  "consultant",
  "consultor",
  "engineer",
  "engenheiro",
  "designer",
  "developer",
  "desenvolvedor",
  "teacher",
  "professor",
  "director",
  "diretor",
];

const validateProfessionalFocus = (profession: string, mode: UserProfile["professionalFocusMode"]) => {
  const normalized = normalizeProfessionText(profession);

  if (mode !== "profession") {
    return {
      status: "unchecked" as const,
      message: "Foco profissional profundo desativado; usando personalização padrão.",
    };
  }

  if (normalized.length < 3 || !/[a-z]/.test(normalized)) {
    return {
      status: "rejected" as const,
      message: "Informe uma profissão ou área profissional reconhecível.",
    };
  }

  if (illegalProfessionTerms.some((term) => normalized.includes(normalizeProfessionText(term)))) {
    return {
      status: "rejected" as const,
      message: "Não é possível focar o plano em uma atividade ilegal ou prejudicial.",
    };
  }

  const recognized =
    recognizedProfessionTerms.some((term) => normalized.includes(normalizeProfessionText(term))) ||
    professionalRoleTerms.some((term) => normalized.includes(normalizeProfessionText(term)));

  if (!recognized) {
    return {
      status: "rejected" as const,
      message:
        "Não reconheci essa profissão. Use uma área comum, como marketing, vendas, suporte, design, tecnologia, saúde, educação ou finanças.",
    };
  }

  return {
    status: "verified" as const,
    message: "Profissão reconhecida. O conteúdo será direcionado ao mundo profissional informado.",
  };
};

export class OnboardingService {
  constructor(private readonly dailyPlanService: DailyPlanService) {}

  async buildPlan(userId: string, input: OnboardingInput) {
    const level = input.level.toUpperCase() as EnglishLevel;
    const professionalFocusMode: UserProfile["professionalFocusMode"] =
      input.professionalFocusMode === "profession" ? "profession" : "standard";
    const validation = validateProfessionalFocus(input.profession, professionalFocusMode);

    if (professionalFocusMode === "profession" && validation.status === "rejected") {
      return {
        status: 400,
        body: { message: validation.message },
      };
    }

    const focus =
      input.difficulty === "speaking"
        ? "Build spoken confidence with low-friction practice."
        : input.difficulty === "listening"
          ? "Train your ear with short, comprehensible dialogues."
          : input.difficulty === "pronunciation"
            ? "Improve clarity, stress, and connected speech."
            : "Learn reusable phrases in context.";

    const profile = {
      name: input.name,
      currentLevel: level,
      dailyMinutes: input.dailyMinutes,
      profession: input.profession,
      professionalFocusMode,
      professionValidationStatus: validation.status,
      professionValidationMessage: validation.message,
      primaryGoal: input.objective,
      mainDifficulty: input.difficulty,
      initialSetupCompleted: true,
    };
    const { dailyPlan, progress, user } = await this.dailyPlanService.createPlanForProfile(userId, profile);

    return {
      status: 201,
      body: {
        profile: {
          id: user.id,
          name: user.name,
          email: user.email,
          currentLevel: user.currentLevel,
          dailyMinutes: user.dailyMinutes,
          profession: user.profession,
          professionalFocusMode: user.professionalFocusMode,
          professionValidationStatus: user.professionValidationStatus,
          professionValidationMessage: user.professionValidationMessage,
          primaryGoal: user.primaryGoal,
          mainDifficulty: user.mainDifficulty,
          initialSetupCompleted: user.initialSetupCompleted,
        },
        suggestedPlan: {
          ...dailyPlan,
          focus: dailyPlan.focus || focus,
        },
        progress,
      },
    };
  }
}
