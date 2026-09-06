"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.animalRouter = void 0;
const express_1 = require("express");
const animalService_1 = require("../services/animalService");
exports.animalRouter = (0, express_1.Router)();
exports.animalRouter.get('/animal/:id', (req, res) => {
    const id = String(req.params.id || '');
    (0, animalService_1.getAnimalById)(id)
        .then(data => {
        res.status(200).json({ success: true, data });
    })
        .catch(() => {
        res.status(500).json({
            success: false,
            error: {
                code: 'ANIMAL_FETCH_FAILED',
                message: 'Failed to fetch animal data',
            },
        });
    });
});
