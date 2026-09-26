// 动物相关类型定义

import { IUCNStatus, TaxonomyLevel } from '../constants/taxonomy';

// 生物分类信息
export interface TaxonomyInfo {
  kingdom?: TaxonomyItem; // 界
  phylum?: TaxonomyItem; // 门
  class?: TaxonomyItem; // 纲
  order?: TaxonomyItem; // 目
  family?: TaxonomyItem; // 科
  genus?: TaxonomyItem; // 属
  species?: TaxonomyItem; // 种
}

export interface TaxonomyItem {
  scientificName: string; // 学名
  commonNameZh: string; // 中文名
  commonNameEn?: string; // 英文名
}

// 动物基本信息
export interface Animal {
  id: string;
  commonNameZh: string; // 中文名
  commonNameEn: string; // 英文名
  scientificName: string; // 学名
  taxonomy: TaxonomyInfo; // 分类信息
  images: string[]; // 图片URLs
  thumbnailUrl?: string; // 缩略图
  description?: string; // 简介
  habitat?: string; // 栖息地
  lifestyle?: string; // 生活习性
  distribution?: string; // 分布区域
  conservationStatus?: ConservationInfo; // 保护状态
}

// 保护状态信息
export interface ConservationInfo {
  iucnStatus: IUCNStatus; // IUCN等级
  population?: number; // 种群数量
  populationTrend?: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  assessmentYear?: number; // 评估年份
  threats?: string[]; // 主要威胁
}

// 图像识别结果
export interface RecognitionResult {
  animal: Animal;
  confidence: number; // 置信度 0-1
  boundingBox?: BoundingBox; // 检测框
  timestamp: number; // 识别时间戳
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 分类树节点
export interface TaxonomyNode {
  id: string;
  level: TaxonomyLevel;
  scientificName: string;
  commonNameZh: string;
  commonNameEn?: string;
  childCount?: number; // 子节点数量
  children?: TaxonomyNode[]; // 子节点
  parent?: TaxonomyNode; // 父节点
  representativeImage?: string; // 代表图片
  isCurrent?: boolean; // 是否是当前查看的节点
}

// 搜索结果
export interface SearchResult {
  id: string;
  commonNameZh: string;
  commonNameEn: string;
  scientificName: string;
  family: string; // 科
  familyZh: string; // 科（中文）
  thumbnailUrl?: string;
}

// 最近识别记录
export interface RecentRecord {
  id: string;
  animal: Animal;
  imageUri: string; // 本地图片URI
  timestamp: number;
  confidence: number;
}

/**
 * 持久化的「最近识别」记录。
 *
 * 存的内容必须足以让首页点回详情页：
 * - `id` 用**学名**（详情接口 `/api/animal/:id` 的 key 约定），否则回跳会 404
 * - 学名 / 中英文名 / 图片 / 置信度用于离线渲染
 * - 分类、濒危等信息不在本地存储里，由详情页异步补齐
 */
export interface RecentAnimalRecord {
  id: string;
  commonNameZh: string;
  commonNameEn?: string;
  scientificName?: string;
  thumbnailUrl?: string;
  imageUri?: string;
  confidence?: number;
  timestamp: number;
}
