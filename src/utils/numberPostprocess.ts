import type { RoiConfig } from '../types/physics';

export function normalizeRecognizedNumber(value: number, roiConfig: RoiConfig) {
  const factor = 10 ** roiConfig.decimalPlaces;
  const normalized =
    roiConfig.roundingMode === 'truncate'
      ? Math.trunc(value * factor) / factor
      : Math.round(value * factor) / factor;

  return {
    value: normalized,
    rawValue: value,
    displayValue: normalized.toFixed(roiConfig.decimalPlaces),
  };
}
