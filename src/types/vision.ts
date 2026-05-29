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
