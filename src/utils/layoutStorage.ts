export interface LayoutRatios {
  left: number;
  middle: number;
  right: number;
  rightTop: number;
  rightBottom: number;
  leftCollapsed: boolean;
}

const STORAGE_KEY = 'physics-bridge-layout-ratios-v2';

export const DEFAULT_LAYOUT: LayoutRatios = {
  left: 28,
  middle: 34,
  right: 38,
  rightTop: 13,
  rightBottom: 87,
  leftCollapsed: false,
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
