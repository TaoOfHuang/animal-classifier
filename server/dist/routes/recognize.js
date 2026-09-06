"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recognizeRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const recognitionService_1 = require("../services/recognitionService");
exports.recognizeRouter = (0, express_1.Router)();
exports.recognizeRouter.post('/recognize', auth_1.authMiddleware, async (req, res, next) => {
    const image = String(req.body?.image || '');
    try {
        const data = await (0, recognitionService_1.recognizeByImage)({ image });
        const remaining = req
            .dailyCallsRemaining;
        res.set('X-Daily-Calls-Remaining', String(remaining ?? ''));
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
