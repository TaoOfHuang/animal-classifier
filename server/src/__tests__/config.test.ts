import { getPort } from '../config';

describe('getPort', () => {
  it('uses default port when env is empty', () => {
    expect(getPort(undefined)).toBe(3000);
  });

  it('throws on invalid port', () => {
    expect(() => getPort('abc')).toThrow('Invalid PORT value: abc');
  });
});
