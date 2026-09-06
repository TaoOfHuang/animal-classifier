// 分类数据服务层
// 提供分类树数据的获取、懒加载和缓存

import { TaxonomyNode, TaxonomyInfo, TaxonomyItem } from '../types';
import { TaxonomyLevel } from '../constants/taxonomy';
import { API_BASE_URL } from './api';

// 是否使用后端 API（当前为 mock 模式）
const USE_BACKEND_API = false;

// 分类层级顺序
const TAXONOMY_ORDER: TaxonomyLevel[] = [
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
];

// 获取父级分类层级
export const getParentLevel = (level: TaxonomyLevel): TaxonomyLevel | null => {
  const index = TAXONOMY_ORDER.indexOf(level);
  return index > 0 ? TAXONOMY_ORDER[index - 1] : null;
};

// 获取子级分类层级
export const getChildLevel = (level: TaxonomyLevel): TaxonomyLevel | null => {
  const index = TAXONOMY_ORDER.indexOf(level);
  return index < TAXONOMY_ORDER.length - 1 ? TAXONOMY_ORDER[index + 1] : null;
};

// Mock 数据 - 海龟科分类树
const MOCK_CHELONIIDAE_GENERA: TaxonomyNode[] = [
  {
    id: 'chelonia',
    level: 'genus',
    scientificName: 'Chelonia',
    commonNameZh: '海龟属',
    commonNameEn: 'Chelonia',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=80',
  },
  {
    id: 'caretta',
    level: 'genus',
    scientificName: 'Caretta',
    commonNameZh: '蠵龟属',
    commonNameEn: 'Loggerhead',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1591025207163-942350e47db2?w=80',
  },
  {
    id: 'eretmochelys',
    level: 'genus',
    scientificName: 'Eretmochelys',
    commonNameZh: '玳瑁属',
    commonNameEn: 'Hawksbill',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1518467166778-b88f373ffec7?w=80',
  },
  {
    id: 'lepidochelys',
    level: 'genus',
    scientificName: 'Lepidochelys',
    commonNameZh: '棱皮龟属',
    commonNameEn: 'Olive Ridley',
    childCount: 2,
    representativeImage:
      'https://images.unsplash.com/photo-1562046838-1bc589d77b99?w=80',
  },
  {
    id: 'natator',
    level: 'genus',
    scientificName: 'Natator',
    commonNameZh: '平背龟属',
    commonNameEn: 'Flatback',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1517015302640-5b6c5a3d9b95?w=80',
  },
];

// Mock 数据 - 熊科分类树
const MOCK_URSIDAE_GENERA: TaxonomyNode[] = [
  {
    id: 'ailuropoda',
    level: 'genus',
    scientificName: 'Ailuropoda',
    commonNameZh: '大熊猫属',
    commonNameEn: 'Ailuropoda',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=80',
  },
  {
    id: 'ursus',
    level: 'genus',
    scientificName: 'Ursus',
    commonNameZh: '熊属',
    commonNameEn: 'Ursus',
    childCount: 4,
    representativeImage:
      'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=80',
  },
  {
    id: 'helarctos',
    level: 'genus',
    scientificName: 'Helarctos',
    commonNameZh: '马来熊属',
    commonNameEn: 'Sun Bear',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1520990279522-6e709d3c8a21?w=80',
  },
  {
    id: 'melursus',
    level: 'genus',
    scientificName: 'Melursus',
    commonNameZh: '懒熊属',
    commonNameEn: 'Sloth Bear',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=80',
  },
  {
    id: 'tremarctos',
    level: 'genus',
    scientificName: 'Tremarctos',
    commonNameZh: '眼镜熊属',
    commonNameEn: 'Spectacled Bear',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1551632811-561732d1e306?w=80',
  },
];

// Mock 数据 - 犬科分类树
const MOCK_CANIDAE_GENERA: TaxonomyNode[] = [
  {
    id: 'canis',
    level: 'genus',
    scientificName: 'Canis',
    commonNameZh: '犬属',
    commonNameEn: 'Canis',
    childCount: 8,
    representativeImage:
      'https://images.unsplash.com/photo-1551085254-e96b210db58a?w=80',
  },
  {
    id: 'vulpes',
    level: 'genus',
    scientificName: 'Vulpes',
    commonNameZh: '狐属',
    commonNameEn: 'Vulpes',
    childCount: 12,
    representativeImage:
      'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=80',
  },
  {
    id: 'ursus-canid',
    level: 'genus',
    scientificName: 'Ursus',
    commonNameZh: '熊属',
    commonNameEn: 'Bears',
    childCount: 4,
    representativeImage:
      'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=80',
  },
  {
    id: 'meles',
    level: 'genus',
    scientificName: 'Meles',
    commonNameZh: '獾属',
    commonNameEn: 'Badgers',
    childCount: 3,
    representativeImage:
      'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=80',
  },
];

// Mock 数据 - 猫科动物分类树
const MOCK_FELIDAE_GENERA: TaxonomyNode[] = [
  {
    id: 'panthera',
    level: 'genus',
    scientificName: 'Panthera',
    commonNameZh: '豹属',
    commonNameEn: 'Panthera',
    childCount: 5,
    representativeImage:
      'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=80',
  },
  {
    id: 'felis',
    level: 'genus',
    scientificName: 'Felis',
    commonNameZh: '猫属',
    commonNameEn: 'Felis',
    childCount: 6,
    representativeImage:
      'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=80',
  },
  {
    id: 'acinonyx',
    level: 'genus',
    scientificName: 'Acinonyx',
    commonNameZh: '猎豹属',
    commonNameEn: 'Acinonyx',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=80',
  },
  {
    id: 'neofelis',
    level: 'genus',
    scientificName: 'Neofelis',
    commonNameZh: '云豹属',
    commonNameEn: 'Neofelis',
    childCount: 2,
    representativeImage:
      'https://images.unsplash.com/photo-1606567595334-d39972c85dfd?w=80',
  },
  {
    id: 'lynx',
    level: 'genus',
    scientificName: 'Lynx',
    commonNameZh: '猞猁属',
    commonNameEn: 'Lynx',
    childCount: 4,
    representativeImage:
      'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=80',
  },
  {
    id: 'puma',
    level: 'genus',
    scientificName: 'Puma',
    commonNameZh: '美洲狮属',
    commonNameEn: 'Puma',
    childCount: 1,
    representativeImage:
      'https://images.unsplash.com/photo-1559253664-ca249d4608c6?w=80',
  },
];

const MOCK_PANTHERA_SPECIES: TaxonomyNode[] = [
  {
    id: 'panthera-tigris',
    level: 'species',
    scientificName: 'Panthera tigris',
    commonNameZh: '虎',
    commonNameEn: 'Tiger',
    representativeImage:
      'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=80',
  },
  {
    id: 'panthera-leo',
    level: 'species',
    scientificName: 'Panthera leo',
    commonNameZh: '狮',
    commonNameEn: 'Lion',
    representativeImage:
      'https://images.unsplash.com/photo-1507666664345-c49223375e33?w=80',
  },
  {
    id: 'panthera-pardus',
    level: 'species',
    scientificName: 'Panthera pardus',
    commonNameZh: '豹',
    commonNameEn: 'Leopard',
    representativeImage:
      'https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=80',
  },
  {
    id: 'panthera-onca',
    level: 'species',
    scientificName: 'Panthera onca',
    commonNameZh: '美洲豹',
    commonNameEn: 'Jaguar',
    representativeImage:
      'https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=80',
  },
  {
    id: 'panthera-uncia',
    level: 'species',
    scientificName: 'Panthera uncia',
    commonNameZh: '雪豹',
    commonNameEn: 'Snow Leopard',
    representativeImage:
      'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=80',
  },
];

const MOCK_FELIS_SPECIES: TaxonomyNode[] = [
  {
    id: 'felis-catus',
    level: 'species',
    scientificName: 'Felis catus',
    commonNameZh: '家猫',
    commonNameEn: 'Domestic Cat',
    representativeImage:
      'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=80',
  },
  {
    id: 'felis-silvestris',
    level: 'species',
    scientificName: 'Felis silvestris',
    commonNameZh: '野猫',
    commonNameEn: 'Wildcat',
    representativeImage:
      'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=80',
  },
];

// 延迟模拟网络请求
const delay = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

// 获取分类节点的子节点（懒加载）
export const fetchTaxonomyChildren = async (
  parentId: string,
  parentLevel: TaxonomyLevel,
  limit: number = 10,
  offset: number = 0,
): Promise<{ children: TaxonomyNode[]; hasMore: boolean; total: number }> => {
  if (USE_BACKEND_API) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/taxonomy/${parentLevel}/${parentId}/children?limit=${limit}&offset=${offset}`,
      );
      if (!response.ok) throw new Error('API error');
      return (await response.json()) as {
        children: TaxonomyNode[];
        hasMore: boolean;
        total: number;
      };
    } catch (error) {
      console.warn('Failed to fetch from API, using mock data:', error);
    }
  }

  // Mock 数据
  await delay(300 + Math.random() * 500); // 模拟网络延迟

  let allChildren: TaxonomyNode[] = [];

  if (parentId === 'felidae') {
    allChildren = MOCK_FELIDAE_GENERA;
  } else if (parentId === 'cheloniidae') {
    allChildren = MOCK_CHELONIIDAE_GENERA;
  } else if (parentId === 'ursidae') {
    allChildren = MOCK_URSIDAE_GENERA;
  } else if (parentId === 'canidae') {
    allChildren = MOCK_CANIDAE_GENERA;
  } else if (parentId === 'panthera') {
    allChildren = MOCK_PANTHERA_SPECIES;
  } else if (parentId === 'felis') {
    allChildren = MOCK_FELIS_SPECIES;
  }

  const children = allChildren.slice(offset, offset + limit);
  return {
    children,
    hasMore: offset + limit < allChildren.length,
    total: allChildren.length,
  };
};

// 获取分类树的面包屑路径
export const fetchTaxonomyBreadcrumb = async (
  taxonomy: TaxonomyInfo,
  currentLevel: TaxonomyLevel,
): Promise<TaxonomyItem[]> => {
  const breadcrumb: TaxonomyItem[] = [];

  for (const level of TAXONOMY_ORDER) {
    const item = taxonomy[level];
    if (item) {
      breadcrumb.push(item);
    }
    if (level === currentLevel) break;
  }

  return breadcrumb;
};

// 获取指定分类层级的详情
export const fetchTaxonomyDetail = async (
  level: TaxonomyLevel,
  scientificName: string,
): Promise<{
  current: TaxonomyNode;
  parent?: TaxonomyNode;
  childCount: number;
} | null> => {
  if (USE_BACKEND_API) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/taxonomy/${level}/${encodeURIComponent(scientificName)}`,
      );
      if (!response.ok) throw new Error('API error');
      return (await response.json()) as {
        current: TaxonomyNode;
        parent?: TaxonomyNode;
        childCount: number;
      };
    } catch (error) {
      console.warn('Failed to fetch taxonomy detail:', error);
    }
  }

  // Mock 数据
  await delay(200);

  if (level === 'family' && scientificName.toLowerCase() === 'felidae') {
    return {
      current: {
        id: 'felidae',
        level: 'family',
        scientificName: 'Felidae',
        commonNameZh: '猫科',
        commonNameEn: 'Felidae',
        childCount: 14,
        representativeImage:
          'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=80',
      },
      parent: {
        id: 'carnivora',
        level: 'order',
        scientificName: 'Carnivora',
        commonNameZh: '食肉目',
        commonNameEn: 'Carnivora',
        childCount: 16,
      },
      childCount: 14,
    };
  }

  return null;
};

// 搜索分类节点
export const searchTaxonomy = async (
  query: string,
  level?: TaxonomyLevel,
): Promise<TaxonomyNode[]> => {
  if (USE_BACKEND_API) {
    try {
      const url = level
        ? `${API_BASE_URL}/api/taxonomy/search?q=${encodeURIComponent(query)}&level=${level}`
        : `${API_BASE_URL}/api/taxonomy/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('API error');
      const data = (await response.json()) as { results?: TaxonomyNode[] };
      return data.results || [];
    } catch (error) {
      console.warn('Failed to search taxonomy:', error);
    }
  }

  // Mock 搜索
  await delay(300);
  const lowerQuery = query.toLowerCase();

  const allNodes = [
    ...MOCK_FELIDAE_GENERA,
    ...MOCK_PANTHERA_SPECIES,
    ...MOCK_FELIS_SPECIES,
  ];

  return allNodes.filter(
    node =>
      node.scientificName.toLowerCase().includes(lowerQuery) ||
      node.commonNameZh.includes(query) ||
      node.commonNameEn?.toLowerCase().includes(lowerQuery),
  );
};

// 构建从根到当前节点的完整路径
export const buildTaxonomyPath = (
  taxonomy: TaxonomyInfo,
): Array<{
  level: TaxonomyLevel;
  item: TaxonomyItem;
}> => {
  const path: Array<{ level: TaxonomyLevel; item: TaxonomyItem }> = [];

  for (const level of TAXONOMY_ORDER) {
    const item = taxonomy[level];
    if (item) {
      path.push({ level, item });
    }
  }

  return path;
};

export default {
  fetchTaxonomyChildren,
  fetchTaxonomyBreadcrumb,
  fetchTaxonomyDetail,
  searchTaxonomy,
  buildTaxonomyPath,
  getParentLevel,
  getChildLevel,
};
