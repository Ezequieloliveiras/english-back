"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiController = void 0;
const MAX_MESSAGE_LENGTH = 1600;
const sendSafeError = (response, status, message) => {
    response.status(status).json({ message });
};
const validateUserMessage = (body, response) => {
    if (!body.message?.trim()) {
        sendSafeError(response, 400, "message is required");
        return false;
    }
    if (body.message.length > MAX_MESSAGE_LENGTH) {
        sendSafeError(response, 400, "message is too long");
        return false;
    }
    return true;
};
class AiController {
    constructor(openAiService) {
        this.openAiService = openAiService;
        this.conversation = async (request, response) => {
            try {
                if (!request.auth?.userId)
                    return sendSafeError(response, 401, "Authentication required");
                if (!validateUserMessage(request.body, response))
                    return;
                const result = await this.openAiService.generateConversationReply({
                    ...request.body,
                    userId: request.auth.userId,
                });
                response.json(result);
            }
            catch {
                sendSafeError(response, 500, "AI conversation failed");
            }
        };
        this.devMode = async (request, response) => {
            try {
                if (!request.auth?.userId)
                    return sendSafeError(response, 401, "Authentication required");
                if (!validateUserMessage(request.body, response))
                    return;
                const result = await this.openAiService.generateDeveloperEnglishReply({
                    ...request.body,
                    userId: request.auth.userId,
                });
                response.json(result);
            }
            catch {
                sendSafeError(response, 500, "AI developer mode failed");
            }
        };
        this.thinkInEnglish = async (request, response) => {
            try {
                if (!request.auth?.userId)
                    return sendSafeError(response, 401, "Authentication required");
                if (!validateUserMessage(request.body, response))
                    return;
                const result = await this.openAiService.generateThinkInEnglishReply({
                    ...request.body,
                    userId: request.auth.userId,
                });
                response.json(result);
            }
            catch {
                sendSafeError(response, 500, "AI think in English failed");
            }
        };
        this.vocabulary = async (request, response) => {
            try {
                if (!request.auth?.userId)
                    return sendSafeError(response, 401, "Authentication required");
                const result = await this.openAiService.generateVocabularyExamples({
                    ...request.body,
                    userId: request.auth.userId,
                });
                response.json(result);
            }
            catch {
                sendSafeError(response, 500, "AI vocabulary generation failed");
            }
        };
        this.dailyPlan = async (request, response) => {
            try {
                if (!request.auth?.userId)
                    return sendSafeError(response, 401, "Authentication required");
                const { level, goal, dailyMinutes, difficulty } = request.body;
                if (!level || !goal || !dailyMinutes || !difficulty) {
                    sendSafeError(response, 400, "level, goal, dailyMinutes and difficulty are required");
                    return;
                }
                const result = await this.openAiService.generateDailyPlan({
                    ...request.body,
                    userId: request.auth.userId,
                });
                response.json(result);
            }
            catch {
                sendSafeError(response, 500, "AI daily plan generation failed");
            }
        };
        this.analyzeMistake = async (request, response) => {
            try {
                if (!request.auth?.userId)
                    return sendSafeError(response, 401, "Authentication required");
                const { sentence } = request.body;
                if (!sentence?.trim()) {
                    sendSafeError(response, 400, "sentence is required");
                    return;
                }
                if (sentence.length > MAX_MESSAGE_LENGTH) {
                    sendSafeError(response, 400, "sentence is too long");
                    return;
                }
                const result = await this.openAiService.analyzeStudentMistake({
                    ...request.body,
                    userId: request.auth.userId,
                });
                response.json(result);
            }
            catch {
                sendSafeError(response, 500, "AI mistake analysis failed");
            }
        };
    }
}
exports.AiController = AiController;
