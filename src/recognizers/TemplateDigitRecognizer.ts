import type { NumberRecognizer, RecognizeInput, RecognizeResult } from '../types/physics';
import { imageDataToDataUrl } from '../utils/imagePreprocess';

export class TemplateDigitRecognizer implements NumberRecognizer {
  async recognize(input: RecognizeInput): Promise<RecognizeResult> {
    const roiConfig = input.roiConfig;
    const testedAt = Date.now();
    const warning = 'template-digit 尚未完成模板库，请先采集朗威数字模板';

    return {
      method: 'template-digit',
      value: null,
      rawText: '',
      confidence: 0,
      durationMs: 0,
      warning,
      testedAt,
      debug: {
        roiId: roiConfig.id,
        roiName: roiConfig.name,
        ocrRoi: roiConfig.ocrRoi,
        rawImageDataUrl: imageDataToDataUrl(input.croppedImageData),
        processedImageDataUrl: imageDataToDataUrl(input.preprocessedImageData),
        rawText: '',
        value: null,
        confidence: 0,
        durationMs: 0,
        method: 'template-digit',
        trigger: 'sampling',
        warning,
        testedAt,
        timestamp: testedAt,
      },
    };
  }
}
