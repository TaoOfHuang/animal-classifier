// EndangeredBadge 组件测试

import React from 'react';
import { render } from '@testing-library/react-native';
import { EndangeredBadge } from '../EndangeredBadge';
import { IUCNStatus } from '../../constants/taxonomy';

describe('EndangeredBadge', () => {
  describe('rendering', () => {
    it('renders CR status correctly', () => {
      const { getByText } = render(<EndangeredBadge status="CR" />);
      expect(getByText('极危 (CR)')).toBeTruthy();
    });

    it('renders EN status correctly', () => {
      const { getByText } = render(<EndangeredBadge status="EN" />);
      expect(getByText('濒危 (EN)')).toBeTruthy();
    });

    it('renders VU status correctly', () => {
      const { getByText } = render(<EndangeredBadge status="VU" />);
      expect(getByText('易危 (VU)')).toBeTruthy();
    });

    it('renders NT status correctly', () => {
      const { getByText } = render(<EndangeredBadge status="NT" />);
      expect(getByText('近危 (NT)')).toBeTruthy();
    });

    it('renders LC status correctly', () => {
      const { getByText } = render(<EndangeredBadge status="LC" />);
      expect(getByText('无危 (LC)')).toBeTruthy();
    });
  });

  describe('warning icon', () => {
    it('shows warning icon for endangered statuses (CR, EN, VU)', () => {
      const endangeredStatuses: IUCNStatus[] = ['CR', 'EN', 'VU'];

      endangeredStatuses.forEach(status => {
        const { getByText } = render(
          <EndangeredBadge status={status} showIcon />,
        );
        // 警告图标
        expect(getByText('⚠')).toBeTruthy();
      });
    });

    it('does not show warning icon for non-endangered statuses', () => {
      const nonEndangeredStatuses: IUCNStatus[] = ['NT', 'LC', 'DD', 'NE'];

      nonEndangeredStatuses.forEach(status => {
        const { queryByText } = render(
          <EndangeredBadge status={status} showIcon />,
        );
        expect(queryByText('⚠')).toBeNull();
      });
    });

    it('hides icon when showIcon is false', () => {
      const { queryByText } = render(
        <EndangeredBadge status="CR" showIcon={false} />,
      );
      expect(queryByText('⚠')).toBeNull();
    });
  });

  describe('sizes', () => {
    it('renders in small size', () => {
      const { getByText } = render(
        <EndangeredBadge status="EN" size="small" />,
      );
      expect(getByText('濒危 (EN)')).toBeTruthy();
    });

    it('renders in medium size (default)', () => {
      const { getByText } = render(
        <EndangeredBadge status="EN" size="medium" />,
      );
      expect(getByText('濒危 (EN)')).toBeTruthy();
    });

    it('renders in large size', () => {
      const { getByText } = render(
        <EndangeredBadge status="EN" size="large" />,
      );
      expect(getByText('濒危 (EN)')).toBeTruthy();
    });
  });

  describe('all IUCN statuses', () => {
    const allStatuses: IUCNStatus[] = [
      'EX',
      'EW',
      'CR',
      'EN',
      'VU',
      'NT',
      'LC',
      'DD',
      'NE',
    ];

    it.each(allStatuses)('renders %s status without crashing', status => {
      expect(() => {
        render(<EndangeredBadge status={status} />);
      }).not.toThrow();
    });
  });
});
