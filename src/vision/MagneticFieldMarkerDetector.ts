import type {
  BlueMarkerDebugInfo,
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
  coreCount: number;
  looseCount: number;
  sumDominance: number;
}

type MarkerColor = 'red' | 'blue';

interface BluePixelMatch {
  matched: boolean;
  core: boolean;
  loose: boolean;
  dominanceScore: number;
}

interface BlueDetection {
  marker?: ColorMarkerDetection;
  debug: BlueMarkerDebugInfo;
}

const S_POLE_RETAIN_MS = 500;
const MIN_BLUE_CONFIDENCE = 0.25;
const DEFAULT_BLUE_THRESHOLD: MagneticFieldConfig['blueThreshold'] = {
  coreHueMin: 232,
  coreHueMax: 258,
  coreSaturationMin: 0.45,
  coreValueMin: 0.3,
  coreBMin: 95,
  coreBlueDominanceR: 1.25,
  coreBlueDominanceG: 1.15,
  coreMinChannelDiff: 25,
  looseHueMin: 220,
  looseHueMax: 270,
  looseSaturationMin: 0.22,
  looseValueMin: 0.18,
  looseBMin: 65,
  looseBlueDominanceR: 1.08,
  looseBlueDominanceG: 1.03,
  looseMinChannelDiff: 10,
  minArea: 100,
};

export class MagneticFieldMarkerDetector {
  private lastSPole?: ColorMarkerDetection;

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
    const blueDetection = this.detectBlueMarker(imageData, config, timestamp);
    const retainedSPole = !blueDetection.marker ? this.getRetainedSPole(timestamp) : undefined;
    const sPole = blueDetection.marker ?? retainedSPole;
    const blueDebug = retainedSPole
      ? {
          ...blueDetection.debug,
          detected: true,
          center: { x: retainedSPole.x, y: retainedSPole.y },
          confidence: retainedSPole.confidence,
          retainedFromPrevious: true,
          warning: blueDetection.debug.warning ?? '当前帧未稳定识别，暂保留最近一次 S 极',
        }
      : blueDetection.debug;
    const fieldDirection2D = nPole && sPole ? normalize2D(sPole.x - nPole.x, sPole.y - nPole.y) : undefined;
    const confidence = nPole && sPole ? Number(Math.min(nPole.confidence, sPole.confidence).toFixed(3)) : 0;
    const warning = makeWarning(nPole, sPole, blueDebug);

    return {
      nPole,
      sPole,
      fieldDirection2D,
      confidence,
      warning,
      timestamp,
      frameWidth: imageData.width,
      frameHeight: imageData.height,
      blueDebug,
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

  private detectBlueMarker(imageData: ImageData, config: MagneticFieldConfig, timestamp: number): BlueDetection {
    const { width, height, data } = imageData;
    const mask = new Uint8Array(width * height);
    const coreMask = new Uint8Array(width * height);
    const looseMask = new Uint8Array(width * height);
    const dominance = new Float32Array(width * height);
    let totalBluePixelCount = 0;
    let coreBluePixelCount = 0;
    let looseBluePixelCount = 0;

    for (let offset = 0, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const match = classifyBlueMarkerPixel(r, g, b, config.blueThreshold);
      if (!match.matched) continue;
      mask[pixel] = 1;
      dominance[pixel] = match.dominanceScore;
      totalBluePixelCount += 1;
      if (match.core) {
        coreMask[pixel] = 1;
        coreBluePixelCount += 1;
      }
      if (match.loose) {
        looseMask[pixel] = 1;
        looseBluePixelCount += 1;
      }
    }

    const component = findLargestComponent(mask, width, height, coreMask, looseMask, dominance);
    const minArea = config.blueThreshold.minArea;
    const baseDebug: BlueMarkerDebugInfo = {
      detected: false,
      largestArea: component?.area ?? 0,
      confidence: 0,
      coreBluePixelCount,
      looseBluePixelCount,
      totalBluePixelCount,
      minArea,
      threshold: config.blueThreshold,
    };

    if (totalBluePixelCount <= 0 || !component) {
      return {
        debug: {
          ...baseDebug,
          warning: '蓝色像素不足',
        },
      };
    }

    if (component.area < minArea) {
      return {
        debug: {
          ...baseDebug,
          warning: '最大蓝色连通区域面积太小',
        },
      };
    }

    const x = component.sumX / component.area;
    const y = component.sumY / component.area;
    const radius = Math.max(4, Math.sqrt(component.area / Math.PI));
    const confidence = computeBlueConfidence(component, minArea);

    if (confidence < MIN_BLUE_CONFIDENCE) {
      return {
        debug: {
          ...baseDebug,
          center: { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) },
          confidence,
          warning: '蓝色置信度不足',
        },
      };
    }

    const rawMarker: ColorMarkerDetection = {
      type: 'S',
      x,
      y,
      radius,
      area: component.area,
      confidence,
      color: 'blue',
      detectedAt: timestamp,
    };
    const marker = this.smoothSPole(rawMarker, timestamp);

    return {
      marker,
      debug: {
        ...baseDebug,
        detected: true,
        center: { x: marker.x, y: marker.y },
        confidence: marker.confidence,
      },
    };
  }

  private smoothSPole(marker: ColorMarkerDetection, timestamp: number): ColorMarkerDetection {
    const previous = this.lastSPole;
    const shouldSmooth = previous && timestamp - previous.detectedAt <= S_POLE_RETAIN_MS;
    const next = shouldSmooth
      ? {
          ...marker,
          x: previous.x * 0.7 + marker.x * 0.3,
          y: previous.y * 0.7 + marker.y * 0.3,
          radius: previous.radius && marker.radius ? previous.radius * 0.7 + marker.radius * 0.3 : marker.radius,
        }
      : marker;

    const rounded = {
      ...next,
      x: Number(next.x.toFixed(1)),
      y: Number(next.y.toFixed(1)),
      radius: next.radius !== undefined ? Number(next.radius.toFixed(1)) : undefined,
      confidence: Number(next.confidence.toFixed(3)),
      detectedAt: timestamp,
    };
    this.lastSPole = rounded;
    return rounded;
  }

  private getRetainedSPole(timestamp: number) {
    if (!this.lastSPole || timestamp - this.lastSPole.detectedAt > S_POLE_RETAIN_MS) return undefined;
    return {
      ...this.lastSPole,
      detectedAt: timestamp,
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
  return isBlueMarkerPixel(r, g, b, config.blueThreshold);
}

export function isBlueMarkerPixel(
  r: number,
  g: number,
  b: number,
  threshold: MagneticFieldConfig['blueThreshold'] = DEFAULT_BLUE_THRESHOLD,
) {
  return classifyBlueMarkerPixel(r, g, b, threshold).matched;
}

function classifyBlueMarkerPixel(r: number, g: number, b: number, threshold: MagneticFieldConfig['blueThreshold']): BluePixelMatch {
  const { hue, saturation, value } = rgbToHsv(r, g, b);
  const channelDiff = b - Math.max(r, g);
  const core = (
    hue >= threshold.coreHueMin &&
    hue <= threshold.coreHueMax &&
    saturation >= threshold.coreSaturationMin &&
    value >= threshold.coreValueMin &&
    b >= threshold.coreBMin &&
    b > r * threshold.coreBlueDominanceR &&
    b > g * threshold.coreBlueDominanceG &&
    channelDiff >= threshold.coreMinChannelDiff
  );
  const loose = (
    hue >= threshold.looseHueMin &&
    hue <= threshold.looseHueMax &&
    saturation >= threshold.looseSaturationMin &&
    value >= threshold.looseValueMin &&
    b >= threshold.looseBMin &&
    b > r * threshold.looseBlueDominanceR &&
    b > g * threshold.looseBlueDominanceG &&
    channelDiff >= threshold.looseMinChannelDiff
  );

  return {
    matched: core || loose,
    core,
    loose,
    dominanceScore: computeBlueDominanceScore(r, g, b),
  };
}

function findLargestComponent(
  mask: Uint8Array,
  width: number,
  height: number,
  coreMask?: Uint8Array,
  looseMask?: Uint8Array,
  dominance?: Float32Array,
): ComponentStats | undefined {
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
      coreCount: 0,
      looseCount: 0,
      sumDominance: 0,
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
      stats.coreCount += coreMask?.[pixel] ?? 0;
      stats.looseCount += looseMask?.[pixel] ?? 0;
      stats.sumDominance += dominance?.[pixel] ?? 0;

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

function computeBlueConfidence(component: ComponentStats, minArea: number) {
  const areaScore = clamp(component.area / Math.max(minArea * 4, 1), 0, 1);
  const coreBlueRatio = component.coreCount / Math.max(component.area, 1);
  const colorDominanceScore = component.sumDominance / Math.max(component.area, 1);
  return Number(clamp(0.4 * areaScore + 0.4 * coreBlueRatio + 0.2 * colorDominanceScore, 0, 1).toFixed(3));
}

function computeBlueDominanceScore(r: number, g: number, b: number) {
  const maxChannel = Math.max(b, 1);
  const diffScore = clamp((b - Math.max(r, g)) / 80, 0, 1);
  const redScore = clamp((b - r) / maxChannel, 0, 1);
  const greenScore = clamp((b - g) / maxChannel, 0, 1);
  return clamp((diffScore + redScore + greenScore) / 3, 0, 1);
}

function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return {
    hue,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makeWarning(nPole?: ColorMarkerDetection, sPole?: ColorMarkerDetection, blueDebug?: BlueMarkerDebugInfo) {
  if (!nPole && !sPole) return '未识别到红色 N 极和蓝色 S 极';
  if (!nPole) return '未识别到红色 N 极';
  if (!sPole) return blueDebug?.warning ? `未识别到蓝色 S 极：${blueDebug.warning}` : '未识别到蓝色 S 极';
  return undefined;
}
