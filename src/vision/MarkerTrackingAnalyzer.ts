import type { VisionAnalyzeResult, VisionAnalyzer, VisionRoiConfig } from '../types/vision';

export class MarkerTrackingAnalyzer implements VisionAnalyzer {
  async analyze(_imageData: ImageData, roiConfig: VisionRoiConfig): Promise<VisionAnalyzeResult> {
    return {
      timestamp: Date.now(),
      confidence: 0,
      method: 'marker-tracking',
      warning: `${roiConfig.name} 的 ArUco/AprilTag 标记追踪接口已预留，当前 MVP 未启用真实算法`,
    };
  }
}
