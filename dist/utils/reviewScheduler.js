"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNextReviewDate = void 0;
const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
};
const calculateNextReviewDate = (hits, wasCorrect) => {
    const now = new Date();
    if (!wasCorrect) {
        return addDays(now, 1);
    }
    if (hits >= 5) {
        return addDays(now, 30);
    }
    if (hits >= 3) {
        return addDays(now, 7);
    }
    return addDays(now, 3);
};
exports.calculateNextReviewDate = calculateNextReviewDate;
