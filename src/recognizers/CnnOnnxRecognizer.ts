import type { NumberRecognizer, RecognizeInput, RecognizeResult } from '../types/physics';
import { imageDataToDataUrl } from '../utils/imagePreprocess';

export class CnnOnnxRecognizer implements NumberRecognizer {
  async recognize(input: RecognizeInput): Promise<RecognizeResult> {
    const roiConfig = input.roiConfig;
    const testedAt = Date.now();
    const warning = 'CNN/ONNX 模型尚未接入';

    return {
      method: 'cnn-onnx',
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
        method: 'cnn-onnx',
        trigger: 'sampling',
        warning,
        testedAt,
        timestamp: testedAt,
      },
    };
  }
}
