"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAnimals = void 0;
const searchAnimals = ({ q, limit, offset }) => {
    const keyword = q || '动物';
    return {
        total: 1,
        items: [
            {
                id: `mock-${offset + 1}`,
                commonNameZh: `${keyword}示例`,
                commonNameEn: 'Mock Animal',
                scientificName: 'Animalia mock',
                family: 'MockFamily',
                familyZh: '示例科',
                thumbnailUrl: '',
            },
        ].slice(0, Math.max(0, Math.min(limit, 1))),
    };
};
exports.searchAnimals = searchAnimals;
