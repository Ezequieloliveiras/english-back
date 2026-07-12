"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningController = void 0;
const paramValue = (value) => (Array.isArray(value) ? value[0] : value ?? "");
const queryValue = (value) => (typeof value === "string" && value.trim() ? value : undefined);
class LearningController {
    constructor(learningService) {
        this.learningService = learningService;
        this.roadmap = async (_request, response) => {
            response.json(this.learningService.getRoadmap());
        };
        this.levels = async (_request, response) => {
            response.json({ levels: this.learningService.getLevels() });
        };
        this.level = async (request, response) => {
            const level = this.learningService.getLevel(paramValue(request.params.level));
            if (!level) {
                response.status(404).json({ message: "Level not found" });
                return;
            }
            response.json({ level });
        };
        this.competencies = async (request, response) => {
            response.json({ competencies: this.learningService.getCompetencies(queryValue(request.query.level)) });
        };
        this.competency = async (request, response) => {
            const competency = this.learningService.getCompetency(paramValue(request.params.id));
            if (!competency) {
                response.status(404).json({ message: "Competency not found" });
                return;
            }
            response.json({ competency });
        };
        this.units = async (request, response) => {
            response.json({ units: this.learningService.getUnits(queryValue(request.query.level)) });
        };
        this.unit = async (request, response) => {
            const unit = this.learningService.getUnit(paramValue(request.params.id));
            if (!unit) {
                response.status(404).json({ message: "Learning unit not found" });
                return;
            }
            response.json({ unit });
        };
        this.competencyProfile = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            response.json({ profile: await this.learningService.getCompetencyProfile(request.auth.userId) });
        };
        this.levelProgress = async (request, response) => {
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
        this.userRoadmap = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            response.json({ roadmap: await this.learningService.getUserRoadmap(request.auth.userId) });
        };
        this.dailyLearningContext = async (request, response) => {
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
        this.diagnosticStart = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            response.status(201).json(await this.learningService.startDiagnostic(request.auth.userId, request.body?.declaredLevel));
        };
        this.diagnosticSubmit = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const result = await this.learningService.submitDiagnostic(request.auth.userId, request.body?.attemptId, Array.isArray(request.body?.evidence) ? request.body.evidence : []);
            if (!result) {
                response.status(404).json({ message: "Diagnostic attempt not found" });
                return;
            }
            response.json(result);
        };
        this.diagnosticFinish = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const result = await this.learningService.finishDiagnostic(request.auth.userId, request.body?.attemptId, request.body?.selectedLevel);
            if (!result) {
                response.status(404).json({ message: "Diagnostic attempt not found" });
                return;
            }
            response.json(result);
        };
        this.learningAttempt = async (request, response) => {
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
        this.evidence = async (request, response) => {
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
        this.checkpointStart = async (request, response) => {
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
        this.checkpointSubmit = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const result = await this.learningService.submitCheckpoint(request.auth.userId, paramValue(request.params.id), request.body?.scores ?? {});
            if (!result) {
                response.status(404).json({ message: "Checkpoint not found" });
                return;
            }
            response.json(result);
        };
        this.checkpointFinish = async (request, response) => {
            if (!request.auth?.userId) {
                response.status(401).json({ message: "Authentication required" });
                return;
            }
            const result = await this.learningService.finishCheckpoint(request.auth.userId, paramValue(request.params.id), request.body?.scores ?? {});
            if (!result) {
                response.status(404).json({ message: "Checkpoint not found" });
                return;
            }
            response.json(result);
        };
        this.generateDailyPlan = async (request, response) => {
            await this.dailyLearningContext(request, response);
        };
        this.refineDailyPlan = async (request, response) => {
            await this.dailyLearningContext(request, response);
        };
    }
}
exports.LearningController = LearningController;
