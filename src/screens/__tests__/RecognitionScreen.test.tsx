// RecognitionScreen 错误/重试行为测试。
//
// 这组用例专门盯住一个曾经出现过的 bug：请求失败时 `catch` 里只打了一行日志，
// 既不清理假进度条的 interval，也不给用户任何出路——界面就永久停在 ≤90%。
// 所以这里断言的是「失败之后**有明确反馈且能重试**」，而不只是「不崩」。

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RecognitionScreen } from '../RecognitionScreen';
import { recognizeAnimal } from '../../services/recognitionService';
import type { RecognitionResult } from '../../types';

const mockReplace = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    replace: mockReplace,
    goBack: mockGoBack,
    navigate: jest.fn(),
  }),
  useRoute: () => ({
    params: {
      imageUri: 'file:///tmp/tiger.jpg',
      imageBase64: 'ZmFrZQ==',
      imageMimeType: 'image/jpeg',
    },
  }),
}));

jest.mock('../../services/recognitionService', () => ({
  recognizeAnimal: jest.fn(),
}));

const mockedRecognize = recognizeAnimal as jest.MockedFunction<
  typeof recognizeAnimal
>;

const buildResult = (): RecognitionResult =>
  ({
    animal: { id: '1', commonNameZh: '东北虎' },
    confidence: 0.9,
    timestamp: Date.now(),
  } as RecognitionResult);

describe('RecognitionScreen', () => {
  beforeEach(() => {
    mockedRecognize.mockReset();
    mockReplace.mockReset();
    mockGoBack.mockReset();
  });

  it('识别失败时给出可读文案和重试入口，而不是一直卡在进度条上', async () => {
    mockedRecognize.mockRejectedValue(new TypeError('Network request failed'));

    const { getByText } = render(<RecognitionScreen />);

    await waitFor(() => expect(getByText('网络连接失败')).toBeTruthy(), {
      timeout: 4000,
    });

    // 失败后进度条不该再出现，且必须给出出路
    expect(getByText('重试')).toBeTruthy();
    expect(getByText('重新选图')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('配额用尽这类失败不给重试按钮，避免用户反复撞限额', async () => {
    const quotaError = Object.assign(new Error('今日额度已用完'), {
      status: 429,
      code: 'DEVICE_QUOTA_EXCEEDED',
    });
    mockedRecognize.mockRejectedValue(quotaError);

    const { getByText, queryByText } = render(<RecognitionScreen />);

    await waitFor(() => expect(getByText('今日识别额度已用完')).toBeTruthy(), {
      timeout: 4000,
    });

    expect(queryByText('重试')).toBeNull();
    expect(getByText('重新选图')).toBeTruthy();
  });

  it('点重试会重新发起识别', async () => {
    mockedRecognize.mockRejectedValueOnce(new TypeError('Network request failed'));
    mockedRecognize.mockResolvedValueOnce(buildResult());

    const { getByText } = render(<RecognitionScreen />);

    await waitFor(() => expect(getByText('网络连接失败')).toBeTruthy(), {
      timeout: 4000,
    });

    fireEvent.press(getByText('重试'));

    await waitFor(() => expect(mockedRecognize).toHaveBeenCalledTimes(2), {
      timeout: 4000,
    });
    await waitFor(() => expect(getByText('识别完成！')).toBeTruthy(), {
      timeout: 4000,
    });
  });

  it('识别成功后才跳结果页', async () => {
    mockedRecognize.mockResolvedValue(buildResult());

    render(<RecognitionScreen />);

    await waitFor(
      () => expect(mockReplace).toHaveBeenCalledWith('Result', expect.anything()),
      { timeout: 4000 },
    );
  });

  it('点「重新选图」返回上一页', async () => {
    mockedRecognize.mockRejectedValue(new TypeError('Network request failed'));

    const { getByText } = render(<RecognitionScreen />);

    await waitFor(() => expect(getByText('重新选图')).toBeTruthy(), {
      timeout: 4000,
    });

    fireEvent.press(getByText('重新选图'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
