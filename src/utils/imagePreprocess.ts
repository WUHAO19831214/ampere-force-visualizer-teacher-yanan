import type { Rect } from '../types/physics';
import type { VisionRoiConfig } from '../types/vision';

type RoiLike = Rect | Pick<VisionRoiConfig, 'x' | 'y' | 'width' | 'height'>;

function sourceDimensions(source: HTMLVideoElement | HTMLCanvasElement) {
  if (source instanceof HTMLVideoElement) {
    return {
      width: source.videoWidth || source.clientWidth || 1,
      height: source.videoHeight || source.clientHeight || 1,
    };
  }
  return { width: source.width || 1, height: source.height || 1 };
}

export function cropRoiFromVideo(source: HTMLVideoElement | HTMLCanvasElement, roi: RoiLike): ImageData {
  const { width: sourceWidth, height: sourceHeight } = sourceDimensions(source);
  const canvas = document.createElement('canvas');
  const x = Math.max(0, Math.round(roi.x * sourceWidth));
  const y = Math.max(0, Math.round(roi.y * sourceHeight));
  const width = Math.max(1, Math.round(roi.width * sourceWidth));
  const height = Math.max(1, Math.round(roi.height * sourceHeight));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('无法创建图像裁剪画布');

  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context) context.putImageData(imageData, 0, 0);
  return canvas;
}

export function imageDataToDataUrl(imageData: ImageData): string {
  return imageDataToCanvas(imageData).toDataURL('image/png');
}

function removeIsolatedPixels(data: Uint8ClampedArray, width: number, height: number) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      const value = copy[index];
      if (value !== 0) continue;
      let darkNeighbors = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const neighbor = ((y + oy) * width + (x + ox)) * 4;
          if (copy[neighbor] === 0) darkNeighbors += 1;
        }
      }
      if (darkNeighbors <= 1) {
        data[index] = 255;
        data[index + 1] = 255;
        data[index + 2] = 255;
      }
    }
  }
}

export function preprocessForNumberRecognition(
  imageData: ImageData,
  options: { scale?: number; threshold?: number; invert?: boolean; removeNoise?: boolean } = {},
): ImageData {
  const scale = options.scale ?? 4;
  const threshold = options.threshold ?? 150;
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return imageData;
  context.putImageData(imageData, 0, 0);

  const scaled = document.createElement('canvas');
  scaled.width = imageData.width * scale;
  scaled.height = imageData.height * scale;
  const scaledContext = scaled.getContext('2d', { willReadFrequently: true });
  if (!scaledContext) return imageData;
  scaledContext.imageSmoothingEnabled = false;
  scaledContext.drawImage(canvas, 0, 0, scaled.width, scaled.height);

  const processed = scaledContext.getImageData(0, 0, scaled.width, scaled.height);
  const data = processed.data;
  for (let index = 0; index < data.length; index += 4) {
    const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.9 + 128));
    let value = contrast > threshold ? 255 : 0;
    if (options.invert) value = 255 - value;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  if (options.removeNoise ?? true) {
    removeIsolatedPixels(data, processed.width, processed.height);
  }
  return processed;
}
