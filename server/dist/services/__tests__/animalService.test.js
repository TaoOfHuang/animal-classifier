"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const animalService_1 = require("../animalService");
describe('getAnimalById', () => {
    it('returns fallback detail with iucn status when external apis are unavailable', async () => {
        const data = await (0, animalService_1.getAnimalById)('1');
        expect(data.id).toBe('1');
        expect(data.taxonomy).toBeTruthy();
        expect(data.conservationStatus?.iucnStatus).toBeTruthy();
        expect(Array.isArray(data.images)).toBe(true);
    });
});
