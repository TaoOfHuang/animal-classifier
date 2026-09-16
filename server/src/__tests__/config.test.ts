import { getPort } from '../config';
import { getConservationSource, warnIfConservationMisconfigured } from '../services/conservation';
import { logger } from '../utils/logger';

describe('getPort', () => {
  it('uses default port when env is empty', () => {
    expect(getPort(undefined)).toBe(3000);
  });

  it('throws on invalid port', () => {
    expect(() => getPort('abc')).toThrow('Invalid PORT value: abc');
  });
});

describe('conservation config', () => {
  const originalToken = process.env.IUCN_API_TOKEN;

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CONSERVATION_SOURCE;
    if (originalToken === undefined) {
      delete process.env.IUCN_API_TOKEN;
    } else {
      process.env.IUCN_API_TOKEN = originalToken;
    }
  });

  it('defaults to the offline dataset', () => {
    expect(getConservationSource(undefined)).toBe('static');
  });

  it('accepts both supported sources', () => {
    expect(getConservationSource('static')).toBe('static');
    expect(getConservationSource('iucn_v4')).toBe('iucn_v4');
    expect(getConservationSource('  iucn_v4  ')).toBe('iucn_v4');
  });

  it('throws on an unsupported source instead of silently falling back', () => {
    expect(() => getConservationSource('banana')).toThrow(
      'Invalid CONSERVATION_SOURCE: "banana"',
    );
  });

  it('warns but does not throw when iucn_v4 is selected without a token', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    process.env.CONSERVATION_SOURCE = 'iucn_v4';
    delete process.env.IUCN_API_TOKEN;

    expect(() => warnIfConservationMisconfigured()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      'conservation',
      expect.stringContaining('IUCN_API_TOKEN'),
    );
  });

  it('logs the source when iucn_v4 has a token', () => {
    const info = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    process.env.CONSERVATION_SOURCE = 'iucn_v4';
    process.env.IUCN_API_TOKEN = 'token';

    warnIfConservationMisconfigured();

    expect(info).toHaveBeenCalledWith('conservation', 'data source = iucn_v4');
  });

  it('logs the offline source by default', () => {
    const info = jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    warnIfConservationMisconfigured();

    expect(info).toHaveBeenCalledWith('conservation', 'data source = static');
  });
});
