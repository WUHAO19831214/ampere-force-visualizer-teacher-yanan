import type { VisionAnalyzeResult, VisionAnalyzer, VisionRoiConfig } from '../types/vision';

export class MockVisionAnalyzer implements VisionAnalyzer {
  async analyze(_imageData: ImageData, roiConfig: VisionRoiConfig): Promise<VisionAnalyzeResult> {
    const now = performance.now();
    const seconds = now / 1000;
    const phase = seconds * 1.5;
    const centerX = roiConfig.x + roiConfig.width / 2;
    const centerY = roiConfig.y + roiConfig.height / 2;
    const displacement = 35 * Math.sin(phase);

    return {
      timestamp: Date.now(),
      x: Number((centerX * 640 + displacement).toFixed(2)),
      y: Number((centerY * 480 + 8 * Math.cos(phase)).toFixed(2)),
      angle: Number(((phase * 45) % 360).toFixed(2)),
      displacement: Number(displacement.toFixed(2)),
      velocity: Number((35 * 1.5 * Math.cos(phase)).toFixed(2)),
      angularVelocity: 67.5,
      confidence: 0.95,
      method: 'mock',
    };
  }
}
