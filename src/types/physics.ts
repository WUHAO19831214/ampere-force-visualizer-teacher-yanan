export type RecognizerMethod = 'mock' | 'tesseract' | 'cnn-onnx' | 'template-digit';
export type PreprocessMode = 'auto' | 'grayscale-threshold' | 'high-contrast' | 'invert' | 'color-number';
export type RoundingMode = 'round' | 'truncate';
export type TesseractPsmMode = 'SINGLE_LINE' | 'SINGLE_WORD' | 'SINGLE_BLOCK';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoiConfig {
  id: string;
  channelId: string;
  name: string;
  symbol: string;
  unit: string;
  displayRoi: Rect;
  ocrRoi: Rect;
  decimalPlaces: number;
  sampleRateHz: number;
  recognizerMethod: RecognizerMethod;
  preprocessMode: PreprocessMode;
  roundingMode: RoundingMode;
  psmMode: TesseractPsmMode;
  enableSmoothing: boolean;
  enableOutlierFilter: boolean;
  enabled: boolean;
  minValue?: number;
  maxValue?: number;
  maxDeltaPerSample?: number;
}

export interface PhysicsSample {
  roiId: string;
  channelId: string;
  name: string;
  symbol: string;
  unit: string;
  timestamp: number;
  value: number;
  displayValue?: string;
  rawValue?: number;
  rawText?: string;
  confidence?: number;
  durationMs?: number;
  method: RecognizerMethod;
  source: 'screen-roi';
  warning?: string;
}

export interface RecognizeResult {
  method: RecognizerMethod;
  value: number | null;
  rawText: string;
  confidence: number;
  durationMs: number;
  warning?: string;
  error?: string;
  passedPhysicsCheck?: boolean;
  testedAt: number;
  debug?: OcrDebugInfo;
}

export interface RecognizeInput {
  roiId: string;
  method: RecognizerMethod;
  croppedImageData: ImageData;
  preprocessedImageData: ImageData;
  roiConfig: RoiConfig;
}

export interface NumberRecognizer {
  recognize(input: RecognizeInput): Promise<RecognizeResult>;
}

export interface OcrDebugInfo {
  roiId: string;
  roiName: string;
  ocrRoi: Rect;
  rawImageDataUrl?: string;
  processedImageDataUrl?: string;
  rawText: string;
  value: number | null;
  confidence: number;
  durationMs?: number;
  error?: string;
  testedAt?: number;
  videoPixelRoi?: Rect;
  validationPassed?: boolean;
  accepted?: boolean;
  failureCount?: number;
  warning?: string;
  method: RecognizerMethod;
  trigger?: 'sampling' | 'manual-test';
  timestamp: number;
}

export interface OcrMethodTestResult {
  roiId: string;
  method: RecognizerMethod;
  rawText: string;
  value: number | null;
  confidence: number;
  durationMs: number;
  warning?: string;
  error?: string;
  passedPhysicsCheck?: boolean;
  testedAt: number;
  rawImageDataUrl?: string;
  processedImageDataUrl?: string;
  videoPixelRoi?: Rect;
}
