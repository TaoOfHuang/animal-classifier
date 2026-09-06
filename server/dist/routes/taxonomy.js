"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxonomyRouter = void 0;
const express_1 = require("express");
const taxonomyService_1 = require("../services/taxonomyService");
exports.taxonomyRouter = (0, express_1.Router)();
exports.taxonomyRouter.get('/taxonomy/:level/:name', (req, res) => {
    const level = String(req.params.level || '');
    const name = String(req.params.name || '');
    (0, taxonomyService_1.getTaxonomyTree)(level, name)
        .then(data => {
        res.status(200).json({
            success: true,
            data,
        });
    })
        .catch(() => {
        res.status(200).json({
            success: true,
            data: {
                current: { level, scientificName: name, commonNameZh: `${name}分类` },
                parent: null,
                children: [],
            },
        });
    });
});
