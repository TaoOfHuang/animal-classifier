// AnimalCard 组件测试

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AnimalCard } from '../AnimalCard';
import { SearchResult, Animal } from '../../types';

describe('AnimalCard', () => {
  const mockSearchResult: SearchResult = {
    id: 'tiger',
    commonNameZh: '老虎',
    commonNameEn: 'Tiger',
    scientificName: 'Panthera tigris',
    family: 'Felidae',
    familyZh: '猫科',
    thumbnailUrl: 'https://example.com/tiger.jpg',
  };

  const mockAnimal: Animal = {
    id: 'tiger',
    commonNameZh: '老虎',
    commonNameEn: 'Tiger',
    scientificName: 'Panthera tigris',
    taxonomy: {
      kingdom: { scientificName: 'Animalia', commonNameZh: '动物界' },
      family: { scientificName: 'Felidae', commonNameZh: '猫科' },
    },
    images: ['https://example.com/tiger.jpg'],
    conservationStatus: { iucnStatus: 'EN' },
  };

  describe('horizontal variant (default)', () => {
    it('renders animal name in Chinese', () => {
      const { getByText } = render(<AnimalCard animal={mockSearchResult} />);
      expect(getByText('老虎')).toBeTruthy();
    });

    it('renders scientific name', () => {
      const { getByText } = render(<AnimalCard animal={mockSearchResult} />);
      expect(getByText('Panthera tigris')).toBeTruthy();
    });

    it('renders family when showFamily is true', () => {
      const { getByText } = render(
        <AnimalCard animal={mockSearchResult} showFamily />,
      );
      expect(getByText('猫科 · Felidae')).toBeTruthy();
    });

    it('calls onPress when pressed', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <AnimalCard animal={mockSearchResult} onPress={onPressMock} />,
      );

      fireEvent.press(getByText('老虎'));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('vertical variant', () => {
    it('renders animal name', () => {
      const { getByText } = render(
        <AnimalCard animal={mockSearchResult} variant="vertical" />,
      );
      expect(getByText('老虎')).toBeTruthy();
    });

    it('calls onPress when pressed', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <AnimalCard
          animal={mockSearchResult}
          variant="vertical"
          onPress={onPressMock}
        />,
      );

      fireEvent.press(getByText('老虎'));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('compact variant', () => {
    it('renders animal name and scientific name', () => {
      const { getByText } = render(
        <AnimalCard animal={mockSearchResult} variant="compact" />,
      );
      expect(getByText('老虎')).toBeTruthy();
      expect(getByText('Panthera tigris')).toBeTruthy();
    });

    it('calls onPress when pressed', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <AnimalCard
          animal={mockSearchResult}
          variant="compact"
          onPress={onPressMock}
        />,
      );

      fireEvent.press(getByText('老虎'));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('with Animal type', () => {
    it('renders correctly with Animal object', () => {
      const { getByText } = render(<AnimalCard animal={mockAnimal} />);
      expect(getByText('老虎')).toBeTruthy();
      expect(getByText('Panthera tigris')).toBeTruthy();
    });

    it('shows family from taxonomy when available', () => {
      const { getByText } = render(
        <AnimalCard animal={mockAnimal} showFamily />,
      );
      expect(getByText('猫科')).toBeTruthy();
    });
  });
});
