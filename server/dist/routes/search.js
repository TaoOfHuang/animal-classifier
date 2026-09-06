"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = void 0;
const express_1 = require("express");
const searchService_1 = require("../services/searchService");
exports.searchRouter = (0, express_1.Router)();
exports.searchRouter.get('/search', (req, res) => {
    const q = String(req.query.q || '');
    const limit = Number(req.query.limit || 20);
    const offset = Number(req.query.offset || 0);
    const data = (0, searchService_1.searchAnimals)({ q, limit, offset });
    res.status(200).json({
        success: true,
        data,
    });
});
