import type { NumberRecognizer, RecognizeInput, RecognizeResult } from '../types/physics';
import { imageDataToDataUrl } from '../utils/imagePreprocess';

export class MockRecognizer implements NumberRecognizer {
  async recognize(input: RecognizeInput): Promise<RecognizeResult> {
    const roiConfig = input.roiConfig;
    const now = performance.now() / 1000;
    let value = 0;

    if (roiConfig.channelId === 'F1') {
      value = 2.15 + 0.3 * Math.sin(now * 1.3);
    } else if (roiConfig.channelId === 'F2') {
      value = 2.21 + 0.35 * Math.sin(now * 1.1 + 0.7);
    } else if (roiConfig.channelId === 'F3') {
      value = 0.71 + 0.12 * Math.cos(now * 1.6);
    } else if (roiConfig.channelId === 'time') {
      value = now;
    } else if (roiConfig.channelId === 'displacement') {
      value = 8 + 5 * Math.sin(now * 1.7);
    } else if (roiConfig.channelId === 'force') {
      value = 0.45 + 0.28 * Math.cos(now * 2.1);
    } else {
      value = Math.sin(now) * 10;
    }

    const rounded = Number(value.toFixed(roiConfig.decimalPlaces));
    const testedAt = Date.now();
    const warning = '模拟数据，不代表真实 OCR 结果';

    return {
      method: 'mock',
      value: rounded,
      rawText: String(rounded),
      confidence: 0.96,
      durationMs: 1,
      warning,
      testedAt,
      debug: {
        roiId: roiConfig.id,
        roiName: roiConfig.name,
        ocrRoi: roiConfig.ocrRoi,
        rawImageDataUrl: imageDataToDataUrl(input.croppedImageData),
        processedImageDataUrl: imageDataToDataUrl(input.preprocessedImageData),
        rawText: String(rounded),
        value: rounded,
        confidence: 0.96,
        durationMs: 1,
        method: 'mock',
        trigger: 'sampling',
        warning,
        testedAt,
        timestamp: testedAt,
      },
    };
  }
}
