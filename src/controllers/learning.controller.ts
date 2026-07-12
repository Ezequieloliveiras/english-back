import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { LearningService } from "../services/learning.service";

const paramValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value ?? "");
const queryValue = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  roadmap = async (_request: AuthenticatedRequest, response: Response) => {
    response.json(this.learningService.getRoadmap());
  };

  levels = async (_request: AuthenticatedRequest, response: Response) => {
    response.json({ levels: this.learningService.getLevels() });
  };

  level = async (request: AuthenticatedRequest, response: Response) => {
    const level = this.learningService.getLevel(paramValue(request.params.level));

    if (!level) {
      response.status(404).json({ message: "Level not found" });
      return;
    }

    response.json({ level });
  };

  competencies = async (request: AuthenticatedRequest, response: Response) => {
    response.json({ competencies: this.learningService.getCompetencies(queryValue(request.query.level)) });
  };

  competency = async (request: AuthenticatedRequest, response: Response) => {
    const competency = this.learningService.getCompetency(paramValue(request.params.id));

    if (!competency) {
      response.status(404).json({ message: "Competency not found" });
      return;
    }

    response.json({ competency });
  };

  units = async (request: AuthenticatedRequest, response: Response) => {
    response.json({ units: this.learningService.getUnits(queryValue(request.query.level)) });
  };

  unit = async (request: AuthenticatedRequest, response: Response) => {
    const unit = this.learningService.getUnit(paramValue(request.params.id));

    if (!unit) {
      response.status(404).json({ message: "Learning unit not found" });
      return;
    }

    response.json({ unit });
  };

  competencyProfile = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    response.json({ profile: await this.learningService.getCompetencyProfile(request.auth.userId) });
  };

  levelProgress = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const progress = await this.learningService.getUserLevelProgress(request.auth.userId);

    if (!progress) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    response.json({ progress });
  };

  userRoadmap = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    response.json({ roadmap: await this.learningService.getUserRoadmap(request.auth.userId) });
  };

  dailyLearningContext = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const context = await this.learningService.getDailyLearningContext(request.auth.userId);

    if (!context) {
      response.status(404).json({ message: "Daily learning context not available" });
      return;
    }

    response.json({ context });
  };

  diagnosticStart = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    response.status(201).json(await this.learningService.startDiagnostic(request.auth.userId, request.body?.declaredLevel));
  };

  diagnosticSubmit = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await this.learningService.submitDiagnostic(
      request.auth.userId,
      request.body?.attemptId,
      Array.isArray(request.body?.evidence) ? request.body.evidence : []
    );

    if (!result) {
      response.status(404).json({ message: "Diagnostic attempt not found" });
      return;
    }

    response.json(result);
  };

  diagnosticFinish = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await this.learningService.finishDiagnostic(
      request.auth.userId,
      request.body?.attemptId,
      request.body?.selectedLevel
    );

    if (!result) {
      response.status(404).json({ message: "Diagnostic attempt not found" });
      return;
    }

    response.json(result);
  };

  learningAttempt = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await this.learningService.recordLearningAttempt({
      userId: request.auth.userId,
      ...request.body,
    });
    response.status(result.status).json(result.body);
  };

  evidence = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await this.learningService.recordEvidence({
      userId: request.auth.userId,
      competencyId: paramValue(request.params.id),
      evidence: request.body,
    });

    if (!result) {
      response.status(404).json({ message: "Competency not found" });
      return;
    }

    response.status(201).json({ progress: result });
  };

  checkpointStart = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await this.learningService.startCheckpoint(request.auth.userId, paramValue(request.params.id));

    if (!result) {
      response.status(404).json({ message: "Checkpoint not found" });
      return;
    }

    response.status(201).json(result);
  };

  checkpointSubmit = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await this.learningService.submitCheckpoint(
      request.auth.userId,
      paramValue(request.params.id),
      request.body?.scores ?? {}
    );

    if (!result) {
      response.status(404).json({ message: "Checkpoint not found" });
      return;
    }

    response.json(result);
  };

  checkpointFinish = async (request: AuthenticatedRequest, response: Response) => {
    if (!request.auth?.userId) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await this.learningService.finishCheckpoint(
      request.auth.userId,
      paramValue(request.params.id),
      request.body?.scores ?? {}
    );

    if (!result) {
      response.status(404).json({ message: "Checkpoint not found" });
      return;
    }

    response.json(result);
  };

  generateDailyPlan = async (request: AuthenticatedRequest, response: Response) => {
    await this.dailyLearningContext(request, response);
  };

  refineDailyPlan = async (request: AuthenticatedRequest, response: Response) => {
    await this.dailyLearningContext(request, response);
  };
}
