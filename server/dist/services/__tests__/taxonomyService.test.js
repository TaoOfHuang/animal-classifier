"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taxonomyService_1 = require("../taxonomyService");
describe('getTaxonomyTree', () => {
    it('returns fallback structure when external api is unavailable', async () => {
        const result = await (0, taxonomyService_1.getTaxonomyTree)('family', 'Felidae');
        expect(result.current.level).toBe('family');
        expect(result.current.scientificName).toBe('Felidae');
        expect(Array.isArray(result.children)).toBe(true);
    });
});
