import { DailyPlanService } from "./dailyPlan.service";
import { EnglishLevel, UserProfile } from "../types";
import { UserGoalRepository } from "../repositories/userGoal.repository";

interface ProfilePlanInput {
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

export class ProfilePlanService {
  constructor(
    private readonly dailyPlanService: DailyPlanService,
    private readonly userGoalRepository?: UserGoalRepository
  ) {}

  private prepareProfile(input: ProfilePlanInput) {
    const level = input.level.toUpperCase() as EnglishLevel;
    const professionalFocusMode: UserProfile["professionalFocusMode"] =
      input.professionalFocusMode === "profession" ? "profession" : "standard";
    const validation = validateProfessionalFocus(input.profession, professionalFocusMode);

    if (professionalFocusMode === "profession" && validation.status === "rejected") {
      return { error: validation.message };
    }

    const focus =
      input.difficulty === "speaking"
        ? "Build spoken confidence with low-friction practice."
        : input.difficulty === "listening"
          ? "Train your ear with short, comprehensible dialogues."
          : input.difficulty === "pronunciation"
            ? "Improve clarity, stress, and connected speech."
            : "Learn reusable phrases in context.";

    return {
      focus,
      level,
      profile: {
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
      },
    };
  }

  private async syncGoal(userId: string, input: ProfilePlanInput, level: EnglishLevel) {
    await this.userGoalRepository?.upsertGoal(userId, {
      primaryGoal: input.objective,
      targetLevel: level,
      professionalContext: input.profession,
    });
  }

  private responseProfile(user: UserProfile) {
    return {
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
    };
  }

  async updateProfile(userId: string, input: ProfilePlanInput) {
    const prepared = this.prepareProfile(input);

    if ("error" in prepared) {
      return {
        status: 400,
        body: { message: prepared.error },
      };
    }

    const user = await this.dailyPlanService.updateProfile(userId, prepared.profile);
    await this.syncGoal(userId, input, prepared.level);

    return {
      status: 200,
      body: {
        profile: this.responseProfile(user),
      },
    };
  }

  async buildPlan(userId: string, input: ProfilePlanInput) {
    const prepared = this.prepareProfile(input);

    if ("error" in prepared) {
      return {
        status: 400,
        body: { message: prepared.error },
      };
    }

    const { dailyPlan, progress, user } = await this.dailyPlanService.createPlanForProfile(userId, prepared.profile);
    await this.syncGoal(userId, input, prepared.level);

    return {
      status: 201,
      body: {
        profile: this.responseProfile(user),
        suggestedPlan: {
          ...dailyPlan,
          focus: dailyPlan.focus || prepared.focus,
        },
        progress,
      },
    };
  }
}
