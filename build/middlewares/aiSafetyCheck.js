"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAIResponse = void 0;
const validateAIResponse = (req, res, next) => {
    // This middleware can be used to validate AI responses before storing or returning them
    const { answer } = req.body;
    if (answer && isPotentialHallucination(answer)) {
        req.body.safeAnswer = "I cannot provide information outside of the document content.";
    }
    else {
        req.body.safeAnswer = answer;
    }
    next();
};
exports.validateAIResponse = validateAIResponse;
const isPotentialHallucination = (text) => {
    const warningPatterns = [
        /(I think|I believe|in my opinion)/i,
        /(generally|usually|typically|always|never)/i,
        /(everyone knows|it is known|common knowledge)/i,
        /(according to sources|studies show|research indicates)/i,
        /(https?:\/\/|www\.|\.com|\.org)/i
    ];
    return warningPatterns.some(pattern => pattern.test(text));
};
