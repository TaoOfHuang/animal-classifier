import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { API_BASE_URL } from '../apiConfig';

// 本文件测的是 deviceAuth 的真实实现，因此用 requireActual 绕过
// jest.setup.js 里的全局 mock（那里为了其他用例把整层替换成了固定令牌）。
jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getUniqueId: jest.fn(() => Promise.resolve('A1B2C3D4E5F60718')),
  },
}));

type DeviceAuthModule = typeof import('../deviceAuth');

const loadDeviceAuth = (): DeviceAuthModule =>
  jest.requireActual<DeviceAuthModule>('../deviceAuth');

const mockGetUniqueId = DeviceInfo.getUniqueId as unknown as jest.Mock;

const TOKEN_KEY = '@animal_classifier:device_token';
const FALLBACK_KEY = '@animal_classifier:fallback_device_id';

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);

describe('deviceAuth', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    loadDeviceAuth().__resetDeviceAuthCacheForTest();

    mockGetUniqueId.mockResolvedValue('A1B2C3D4E5F60718');
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('resolveDeviceId', () => {
    it('优先采用系统设备标识，并规范化为小写', async () => {
      const { resolveDeviceId } = loadDeviceAuth();

      await expect(resolveDeviceId()).resolves.toBe('a1b2c3d4e5f60718');
      // 不该走兜底分支
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        FALLBACK_KEY,
        expect.anything(),
      );
    });

    it('系统标识为空时降级为本地随机 ID 并持久化', async () => {
      mockGetUniqueId.mockResolvedValue('');
      const { resolveDeviceId } = loadDeviceAuth();

      const deviceId = await resolveDeviceId();

      expect(deviceId).toMatch(/^[0-9a-f]{32}$/);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(FALLBACK_KEY, deviceId);
    });

    it('系统标识抛错时同样降级，不让注册流程中断', async () => {
      mockGetUniqueId.mockRejectedValue(new Error('native module not linked'));
      const { resolveDeviceId } = loadDeviceAuth();

      await expect(resolveDeviceId()).resolves.toMatch(/^[0-9a-f]{32}$/);
    });

    it('已有兜底 ID 时复用它，不重复生成', async () => {
      mockGetUniqueId.mockResolvedValue('');
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === FALLBACK_KEY ? 'f'.repeat(32) : null),
      );

      const { resolveDeviceId } = loadDeviceAuth();
      await expect(resolveDeviceId()).resolves.toBe('f'.repeat(32));
    });
  });

  describe('getDeviceToken', () => {
    it('本地已有令牌时直接返回，不发起注册请求', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === TOKEN_KEY ? 'stored-token' : null),
      );
      const fetchMock = jest.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const { getDeviceToken } = loadDeviceAuth();

      await expect(getDeviceToken()).resolves.toBe('stored-token');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('本地无令牌时走注册端点并落盘', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse({ success: true, data: { token: 'fresh-token', dailyLimit: 20 } }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const { getDeviceToken } = loadDeviceAuth();

      await expect(getDeviceToken()).resolves.toBe('fresh-token');
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/auth/device`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(TOKEN_KEY, 'fresh-token');
    });

    it('并发请求只触发一次注册', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse({ success: true, data: { token: 'once-token', dailyLimit: 20 } }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const { getDeviceToken } = loadDeviceAuth();

      const [a, b, c] = await Promise.all([
        getDeviceToken(),
        getDeviceToken(),
        getDeviceToken(),
      ]);

      expect([a, b, c]).toEqual(['once-token', 'once-token', 'once-token']);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerDevice', () => {
    it('设备已被封禁（403）时抛出带状态码的错误', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse(
          { success: false, error: { code: 'DEVICE_REVOKED', message: 'revoked' } },
          false,
          403,
        ),
      ) as unknown as typeof fetch;

      const auth = loadDeviceAuth();

      await expect(auth.registerDevice()).rejects.toMatchObject({
        name: 'DeviceAuthError',
        status: 403,
        code: 'DEVICE_REVOKED',
      });
    });

    it('注册失败时不写入令牌', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ success: false, error: { message: 'boom' } }, false, 500),
      ) as unknown as typeof fetch;

      const auth = loadDeviceAuth();

      await expect(auth.registerDevice()).rejects.toBeInstanceOf(
        auth.DeviceAuthError,
      );
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        TOKEN_KEY,
        expect.anything(),
      );
    });
  });

  describe('clearDeviceToken', () => {
    it('清掉内存缓存与持久化令牌，下次调用会重新注册', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ success: true, data: { token: 'first-token', dailyLimit: 20 } }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ success: true, data: { token: 'second-token', dailyLimit: 20 } }),
        );
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const auth = loadDeviceAuth();

      await expect(auth.getDeviceToken()).resolves.toBe('first-token');
      await auth.clearDeviceToken();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(TOKEN_KEY);

      // 缓存已清，所以会再走一次注册
      await expect(auth.getDeviceToken()).resolves.toBe('second-token');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
