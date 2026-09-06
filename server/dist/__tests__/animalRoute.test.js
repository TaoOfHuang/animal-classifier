"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
describe('GET /api/animal/:id', () => {
    it('returns animal detail data', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/animal/1');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe('1');
        expect(res.body.data.taxonomy).toBeTruthy();
    });
});
