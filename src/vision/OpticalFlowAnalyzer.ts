import type { VisionAnalyzeResult, VisionAnalyzer, VisionRoiConfig } from '../types/vision';

export class OpticalFlowAnalyzer implements VisionAnalyzer {
  async analyze(_imageData: ImageData, roiConfig: VisionRoiConfig): Promise<VisionAnalyzeResult> {
    return {
      timestamp: Date.now(),
      confidence: 0,
      method: 'optical-flow',
      warning: `${roiConfig.name} 的光流分析接口已预留，当前 MVP 未启用真实算法`,
    };
  }
}
