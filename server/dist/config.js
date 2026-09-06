"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyLimit = exports.getPort = void 0;
const getPort = (rawPort) => {
    if (!rawPort) {
        return 3000;
    }
    const parsed = Number(rawPort);
    const isValidInteger = Number.isInteger(parsed);
    if (!isValidInteger || parsed < 1 || parsed > 65535) {
        throw new Error(`Invalid PORT value: ${rawPort}`);
    }
    return parsed;
};
exports.getPort = getPort;
const getDailyLimit = () => {
    const raw = process.env.AI_RECOGNIZE_DAILY_LIMIT;
    if (!raw)
        return 100;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid AI_RECOGNIZE_DAILY_LIMIT value: ${raw}`);
    }
    return parsed;
};
exports.getDailyLimit = getDailyLimit;
