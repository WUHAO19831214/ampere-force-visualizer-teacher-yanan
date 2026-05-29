import type { VisionAnalyzeResult, VisionAnalyzer, VisionRoiConfig } from '../types/vision';

export class ColorTrackingAnalyzer implements VisionAnalyzer {
  async analyze(_imageData: ImageData, roiConfig: VisionRoiConfig): Promise<VisionAnalyzeResult> {
    return {
      timestamp: Date.now(),
      confidence: 0,
      method: 'color-tracking',
      warning: `${roiConfig.name} 的颜色标记追踪接口已预留，当前 MVP 未启用真实算法`,
    };
  }
}
