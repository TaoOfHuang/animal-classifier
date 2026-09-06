"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
const recognitionService_1 = require("../services/recognitionService");
jest.mock('../services/recognitionService', () => ({
    recognizeByImage: jest.fn(),
}));
const mockRecognizeByImage = recognitionService_1.recognizeByImage;
describe('POST /api/recognize', () => {
    const originalToken = process.env.API_TOKEN;
    const originalLimit = process.env.AI_RECOGNIZE_DAILY_LIMIT;
    beforeEach(() => {
        // Ensure no token is required (auth middleware skips when API_TOKEN is empty)
        delete process.env.API_TOKEN;
        delete process.env.AI_RECOGNIZE_DAILY_LIMIT;
        mockRecognizeByImage.mockResolvedValue({
            animal: {
                id: 'Ailuropoda melanoleuca',
                commonNameZh: '大熊猫',
                commonNameEn: 'Giant Panda',
                scientificName: 'Ailuropoda melanoleuca',
            },
            confidence: 0.87,
        });
    });
    afterEach(() => {
        jest.clearAllMocks();
        if (originalToken !== undefined) {
            process.env.API_TOKEN = originalToken;
        }
        else {
            delete process.env.API_TOKEN;
        }
        if (originalLimit !== undefined) {
            process.env.AI_RECOGNIZE_DAILY_LIMIT = originalLimit;
        }
        else {
            delete process.env.AI_RECOGNIZE_DAILY_LIMIT;
        }
    });
    it('returns AI recognition result (no-token mode)', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/recognize')
            .send({ image: 'base64-or-uri' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.animal.commonNameZh).toBe('大熊猫');
        expect(mockRecognizeByImage).toHaveBeenCalledWith({ image: 'base64-or-uri' });
    });
});
