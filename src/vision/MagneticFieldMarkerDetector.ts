import type {
  ColorMarkerDetection,
  MagneticFieldConfig,
  MagneticFieldDetectionResult,
  MagnetPoleType,
} from '../types/vision';

interface ComponentStats {
  area: number;
  sumX: number;
  sumY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

type MarkerColor = 'red' | 'blue';

export class MagneticFieldMarkerDetector {
  detect(imageData: ImageData, config: MagneticFieldConfig): MagneticFieldDetectionResult {
    const timestamp = Date.now();
    if (!config.enabled || !config.detectionEnabled) {
      return {
        confidence: 0,
        warning: '磁极颜色识别未启用',
        timestamp,
        frameWidth: imageData.width,
        frameHeight: imageData.height,
      };
    }

    const nPole = this.detectMarker(imageData, 'N', 'red', config);
    const sPole = this.detectMarker(imageData, 'S', 'blue', config);
    const fieldDirection2D = nPole && sPole ? normalize2D(sPole.x - nPole.x, sPole.y - nPole.y) : undefined;
    const confidence = nPole && sPole ? Number(Math.min(nPole.confidence, sPole.confidence).toFixed(3)) : 0;
    const warning = makeWarning(nPole, sPole);

    return {
      nPole,
      sPole,
      fieldDirection2D,
      confidence,
      warning,
      timestamp,
      frameWidth: imageData.width,
      frameHeight: imageData.height,
    };
  }

  private detectMarker(
    imageData: ImageData,
    type: MagnetPoleType,
    color: MarkerColor,
    config: MagneticFieldConfig,
  ): ColorMarkerDetection | undefined {
    const { width, height, data } = imageData;
    const mask = new Uint8Array(width * height);
    for (let offset = 0, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      mask[pixel] = matchesColor(r, g, b, color, config) ? 1 : 0;
    }

    const component = findLargestComponent(mask, width, height);
    if (!component || component.area < 20) return undefined;
    const x = component.sumX / component.area;
    const y = component.sumY / component.area;
    const radius = Math.max(4, Math.sqrt(component.area / Math.PI));
    const confidence = Math.min(0.99, component.area / Math.max(600, width * height * 0.012));

    return {
      type,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      radius: Number(radius.toFixed(1)),
      area: component.area,
      confidence: Number(confidence.toFixed(3)),
      color,
      detectedAt: Date.now(),
    };
  }
}

function matchesColor(r: number, g: number, b: number, color: MarkerColor, config: MagneticFieldConfig) {
  if (color === 'red') {
    return (
      r >= config.redThreshold.rMin &&
      g <= config.redThreshold.gMax &&
      b <= config.redThreshold.bMax &&
      r > g * 1.25 &&
      r > b * 1.25
    );
  }
  return (
    b >= config.blueThreshold.bMin &&
    r <= config.blueThreshold.rMax &&
    g <= config.blueThreshold.gMax &&
    b > r * 1.2 &&
    b > g * 1.05
  );
}

function findLargestComponent(mask: Uint8Array, width: number, height: number): ComponentStats | undefined {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let best: ComponentStats | undefined;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    visited[start] = 1;

    const stats: ComponentStats = {
      area: 0,
      sumX: 0,
      sumY: 0,
      minX: width,
      maxX: 0,
      minY: height,
      maxY: 0,
    };

    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      stats.area += 1;
      stats.sumX += x;
      stats.sumY += y;
      stats.minX = Math.min(stats.minX, x);
      stats.maxX = Math.max(stats.maxX, x);
      stats.minY = Math.min(stats.minY, y);
      stats.maxY = Math.max(stats.maxY, y);

      tail = addNeighbor(pixel - 1, x > 0, mask, visited, queue, tail);
      tail = addNeighbor(pixel + 1, x < width - 1, mask, visited, queue, tail);
      tail = addNeighbor(pixel - width, y > 0, mask, visited, queue, tail);
      tail = addNeighbor(pixel + width, y < height - 1, mask, visited, queue, tail);
    }

    if (!best || stats.area > best.area) {
      best = stats;
    }
  }

  return best;
}

function addNeighbor(
  pixel: number,
  allowed: boolean,
  mask: Uint8Array,
  visited: Uint8Array,
  queue: Int32Array,
  tail: number,
) {
  if (!allowed || !mask[pixel] || visited[pixel]) return tail;
  visited[pixel] = 1;
  queue[tail] = pixel;
  return tail + 1;
}

function normalize2D(x: number, y: number) {
  const length = Math.hypot(x, y);
  if (length < 0.0001) return undefined;
  return {
    x: Number((x / length).toFixed(4)),
    y: Number((y / length).toFixed(4)),
  };
}

function makeWarning(nPole?: ColorMarkerDetection, sPole?: ColorMarkerDetection) {
  if (!nPole && !sPole) return '未识别到红色 N 极和蓝色 S 极';
  if (!nPole) return '未识别到红色 N 极';
  if (!sPole) return '未识别到蓝色 S 极';
  return undefined;
}
