// ImageCarousel 组件测试
//
// 回归用例：详情页（AnimalDetailScreen）的图片是两段式替换的——
// 先用本地兜底图渲染，远端详情返回后 mergeRemoteAnimal 换成真实图片组。
// paginationAnim 曾经用 useRef(images.map(...)) 初始化，数组只在首次渲染
// 生成一次，图片变多时 paginationAnim[index] 是 undefined，
// 渲染分页点的 `.interpolate` 抛错，整页红屏（Render Error）。
//
// 注意这里断言的是「圆点数量 === 图片数量」，而不只是「没抛错」：
// 只断言不抛错的话，光靠 renderPagination 里的越界兜底也能通过，
// 锁不住 paginationAnim 必须跟随 images 同步这件事。

import React from 'react';
import { render } from '@testing-library/react-native';
import { ImageCarousel } from '../ImageCarousel';

const makeImages = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `https://example.com/p${index}.jpg`);

const renderCarousel = (count: number) =>
  render(<ImageCarousel images={makeImages(count)} autoPlay={false} />);

const countDots = (queryAllByTestId: (id: RegExp) => unknown[]): number =>
  queryAllByTestId(/^carousel-dot-/).length;

describe('ImageCarousel', () => {
  it('渲染不抛错', () => {
    expect(() => renderCarousel(3)).not.toThrow();
  });

  describe('分页指示器', () => {
    it('圆点数量与图片数量一致', () => {
      const { queryAllByTestId } = renderCarousel(3);

      expect(countDots(queryAllByTestId)).toBe(3);
    });

    it('只有 1 张图时不渲染分页指示器', () => {
      const { queryAllByTestId } = renderCarousel(1);

      expect(countDots(queryAllByTestId)).toBe(0);
    });
  });

  describe('图片数量变化', () => {
    it('数量变多时圆点数量跟着涨（回归：paginationAnim 越界）', () => {
      const { rerender, queryAllByTestId } = renderCarousel(3);
      expect(countDots(queryAllByTestId)).toBe(3);

      expect(() =>
        rerender(<ImageCarousel images={makeImages(5)} autoPlay={false} />),
      ).not.toThrow();
      expect(countDots(queryAllByTestId)).toBe(5);
    });

    it('从 1 张变多张时补齐圆点（回归：分页点从无到有）', () => {
      const { rerender, queryAllByTestId } = renderCarousel(1);
      expect(countDots(queryAllByTestId)).toBe(0);

      expect(() =>
        rerender(<ImageCarousel images={makeImages(4)} autoPlay={false} />),
      ).not.toThrow();
      expect(countDots(queryAllByTestId)).toBe(4);
    });

    it('数量变少时圆点跟着减', () => {
      const { rerender, queryAllByTestId } = renderCarousel(5);

      expect(() =>
        rerender(<ImageCarousel images={makeImages(2)} autoPlay={false} />),
      ).not.toThrow();
      expect(countDots(queryAllByTestId)).toBe(2);
    });
  });

  describe('空图片列表', () => {
    it('渲染占位图而不是轮播', () => {
      const { queryAllByTestId } = renderCarousel(0);

      expect(countDots(queryAllByTestId)).toBe(0);
    });
  });
});
