export interface LayoutRatios {
  left: number;
  middle: number;
  right: number;
  rightTop: number;
  rightBottom: number;
}

const STORAGE_KEY = 'physics-bridge-layout-ratios';

export const DEFAULT_LAYOUT: LayoutRatios = {
  left: 28,
  middle: 34,
  right: 38,
  rightTop: 48,
  rightBottom: 52,
};

export function loadLayoutRatios(): LayoutRatios {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayoutRatios(ratios: LayoutRatios) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratios));
}
