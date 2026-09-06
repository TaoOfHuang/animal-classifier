type SearchParams = {
  q: string;
  limit: number;
  offset: number;
};

export const searchAnimals = ({ q, limit, offset }: SearchParams) => {
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
