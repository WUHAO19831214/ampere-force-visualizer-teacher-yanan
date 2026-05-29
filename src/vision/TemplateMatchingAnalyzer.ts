import type { VisionAnalyzeResult, VisionAnalyzer, VisionRoiConfig } from '../types/vision';

export class TemplateMatchingAnalyzer implements VisionAnalyzer {
  async analyze(_imageData: ImageData, roiConfig: VisionRoiConfig): Promise<VisionAnalyzeResult> {
    return {
      timestamp: Date.now(),
      confidence: 0,
      method: 'template-matching',
      warning: `${roiConfig.name} 的模板匹配接口已预留，当前 MVP 未启用真实算法`,
    };
  }
}
