export type VisionAnalyzerMethod =
  | 'mock'
  | 'color-tracking'
  | 'template-matching'
  | 'marker-tracking'
  | 'optical-flow';

export interface CameraConfig {
  deviceId?: string;
  width: number;
  height: number;
  fps: number;
  enabled: boolean;
}

export interface VisionRoiConfig {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  analyzerMethod: VisionAnalyzerMethod;
  enabled: boolean;
}

export interface VisionSample {
  roiId: string;
  name: string;
  timestamp: number;
  x?: number;
  y?: number;
  angle?: number;
  displacement?: number;
  velocity?: number;
  angularVelocity?: number;
  confidence?: number;
  method: VisionAnalyzerMethod;
  source: 'camera-vision';
  raw?: unknown;
  warning?: string;
}

export interface VisionAnalyzeResult {
  timestamp: number;
  x?: number;
  y?: number;
  angle?: number;
  displacement?: number;
  velocity?: number;
  angularVelocity?: number;
  confidence: number;
  method: VisionAnalyzerMethod;
  warning?: string;
}

export interface VisionAnalyzer {
  analyze(imageData: ImageData, roiConfig: VisionRoiConfig): Promise<VisionAnalyzeResult>;
}

export type MagnetPoleType = 'N' | 'S';

export interface ColorMarkerDetection {
  type: MagnetPoleType;
  x: number;
  y: number;
  radius?: number;
  area?: number;
  confidence: number;
  color: 'red' | 'blue';
  detectedAt: number;
}

export interface BlueThresholdConfig {
  coreHueMin: number;
  coreHueMax: number;
  coreSaturationMin: number;
  coreValueMin: number;
  coreBMin: number;
  coreBlueDominanceR: number;
  coreBlueDominanceG: number;
  coreMinChannelDiff: number;
  looseHueMin: number;
  looseHueMax: number;
  looseSaturationMin: number;
  looseValueMin: number;
  looseBMin: number;
  looseBlueDominanceR: number;
  looseBlueDominanceG: number;
  looseMinChannelDiff: number;
  minArea: number;
}

export interface BlueMarkerDebugInfo {
  detected: boolean;
  center?: {
    x: number;
    y: number;
  };
  largestArea: number;
  confidence: number;
  coreBluePixelCount: number;
  looseBluePixelCount: number;
  totalBluePixelCount: number;
  minArea: number;
  retainedFromPrevious?: boolean;
  warning?: string;
  threshold: BlueThresholdConfig;
}

export interface MagneticFieldDetectionResult {
  nPole?: ColorMarkerDetection;
  sPole?: ColorMarkerDetection;
  fieldDirection2D?: {
    x: number;
    y: number;
  };
  confidence: number;
  warning?: string;
  timestamp: number;
  frameWidth?: number;
  frameHeight?: number;
  blueDebug?: BlueMarkerDebugInfo;
}

export interface MagneticFieldConfig {
  enabled: boolean;
  showFieldLines: boolean;
  detectionEnabled: boolean;
  redThreshold: {
    rMin: number;
    gMax: number;
    bMax: number;
  };
  blueThreshold: BlueThresholdConfig;
  fieldLineCount: number;
  fieldLineLength: number;
  fieldLineSpacing: number;
  wirePosition3D: [number, number, number];
}
