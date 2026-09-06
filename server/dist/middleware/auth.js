"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DAILY_LIMIT_NUM = exports.resetDailyCounter = exports.getTodayKey = exports.getDailyCalls = exports.authMiddleware = void 0;
// ── In-memory daily call counter ────────────────────────────────────
// Key: "YYYY-MM-DD", Value: number of calls made today
const dailyCalls = {};
const DEFAULT_DAILY_LIMIT_NUM = 100;
exports.DEFAULT_DAILY_LIMIT_NUM = DEFAULT_DAILY_LIMIT_NUM;
const getTodayKey = () => new Date().toISOString().slice(0, 10);
exports.getTodayKey = getTodayKey;
const getDailyCalls = () => dailyCalls[getTodayKey()] || 0;
exports.getDailyCalls = getDailyCalls;
const incrementDailyCalls = () => {
    dailyCalls[getTodayKey()] = (dailyCalls[getTodayKey()] || 0) + 1;
};
// ── Public exports ──────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
    // Read env vars at request time so tests can override them
    const API_TOKEN = process.env.API_TOKEN;
    const DAILY_LIMIT = Number(process.env.AI_RECOGNIZE_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT_NUM;
    // If no API_TOKEN is configured, skip auth (development / no-token mode)
    if (!API_TOKEN) {
        return next();
    }
    // Token extraction
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    else {
        token = req.headers['x-api-token'];
    }
    if (!token || token !== API_TOKEN) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Missing or invalid API token.',
            },
        });
        return;
    }
    // ── Daily rate limit ──────────────────────────────────────────────
    const count = getDailyCalls();
    if (count >= DAILY_LIMIT) {
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Daily recognition limit reached (${DAILY_LIMIT} calls). Please try again tomorrow.`,
            },
        });
        return;
    }
    // Record this call
    incrementDailyCalls();
    // Attach call info for downstream logging if needed
    req.dailyCallsRemaining =
        DAILY_LIMIT - count - 1;
    next();
};
exports.authMiddleware = authMiddleware;
// ── Exposed for testing ─────────────────────────────────────────────
const resetDailyCounter = () => {
    Object.keys(dailyCalls).forEach((k) => delete dailyCalls[k]);
};
exports.resetDailyCounter = resetDailyCounter;
