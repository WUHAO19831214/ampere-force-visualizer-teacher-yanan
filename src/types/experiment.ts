import type { PhysicsSample } from './physics';
import type { RecognizerMethod, OcrDebugInfo, OcrMethodTestResult, RoiConfig } from './physics';
import type { MagneticFieldConfig, MagneticFieldDetectionResult, VisionSample } from './vision';

export type DataSourceType = 'screen-roi' | 'camera-vision';

export interface ExperimentDataStore {
  screenSamples: PhysicsSample[];
  visionSamples: VisionSample[];
  latestScreenValues: Record<string, PhysicsSample>;
  latestVisionValues: Record<string, VisionSample>;
  screenRois: RoiConfig[];
  selectedScreenRoiId?: string;
  ocrComparisonResults: Record<string, Partial<Record<RecognizerMethod, OcrMethodTestResult>>>;
  latestMagneticFieldDetection?: MagneticFieldDetectionResult;
  magneticFieldConfig: MagneticFieldConfig;
}

export interface RuntimeStatus {
  screenCapture: 'idle' | 'active' | 'stopped' | 'error';
  camera: 'idle' | 'active' | 'stopped' | 'error';
  ocr: 'idle' | 'mock' | 'ready' | 'warning' | 'error';
  cameraFps: number;
  cameraResolution: string;
  actualScreenSampleRateHz: number;
  screenRoiStatuses: Record<
    string,
    {
      name: string;
      symbol: string;
      method: RecognizerMethod;
      enabled: boolean;
      actualSampleRateHz?: number;
      durationMs?: number;
      failureCount?: number;
      warning?: string;
    }
  >;
  ocrDebugByRoi: Record<string, OcrDebugInfo>;
  warnings: string[];
}
