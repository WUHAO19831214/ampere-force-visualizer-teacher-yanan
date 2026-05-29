import type { PhysicsSample, RoiConfig } from '../types/physics';

interface FilterState {
  latestValid?: PhysicsSample;
  recentValues: number[];
  failureCount: number;
  pendingValue?: number;
  pendingCount: number;
  lastWarning?: string;
}

const filterStates = new Map<string, FilterState>();

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function resetDataFilters() {
  filterStates.clear();
}

export function noteRecognitionFailure(roi: RoiConfig): string | undefined {
  const state = filterStates.get(roi.id) ?? { recentValues: [], failureCount: 0, pendingCount: 0 };
  state.failureCount += 1;
  state.lastWarning = `${roi.name} 连续 ${state.failureCount} 次识别失败，保留上一次有效值`;
  filterStates.set(roi.id, state);
  if (state.failureCount >= 3) return state.lastWarning;
  return undefined;
}

export interface PhysicsDataFilterResult {
  sample: PhysicsSample | null;
  accepted: boolean;
  validationPassed: boolean;
  failureCount: number;
  warning?: string;
}

export function getPhysicsFilterState(roiId: string) {
  return filterStates.get(roiId) ?? { recentValues: [], failureCount: 0, pendingCount: 0 };
}

export function applyPhysicsDataFilters(sample: PhysicsSample, roi: RoiConfig): PhysicsDataFilterResult {
  const state = filterStates.get(roi.id) ?? { recentValues: [], failureCount: 0, pendingCount: 0 };
  let next = { ...sample };
  let warning = sample.warning;

  if (roi.minValue !== undefined && next.value < roi.minValue) {
    state.failureCount += 1;
    state.lastWarning = `${roi.name} 识别值 ${next.value} 小于最小值 ${roi.minValue}，未写入正式数据`;
    filterStates.set(roi.id, state);
    return {
      sample: null,
      accepted: false,
      validationPassed: false,
      failureCount: state.failureCount,
      warning: state.lastWarning,
    };
  }

  if (roi.maxValue !== undefined && next.value > roi.maxValue) {
    state.failureCount += 1;
    state.lastWarning = `${roi.name} 识别值 ${next.value} 大于最大值 ${roi.maxValue}，未写入正式数据`;
    filterStates.set(roi.id, state);
    return {
      sample: null,
      accepted: false,
      validationPassed: false,
      failureCount: state.failureCount,
      warning: state.lastWarning,
    };
  }

  if (roi.enableOutlierFilter && state.latestValid && roi.maxDeltaPerSample !== undefined) {
    const previous = state.latestValid.value;
    const delta = Math.abs(next.value - previous);
    if (delta > roi.maxDeltaPerSample) {
      const closeToPending = state.pendingValue !== undefined && Math.abs(next.value - state.pendingValue) <= roi.maxDeltaPerSample * 0.25;
      state.pendingValue = next.value;
      state.pendingCount = closeToPending ? state.pendingCount + 1 : 1;
      state.lastWarning = `${roi.name} 本次识别跳变 ${delta.toFixed(2)}，等待连续稳定后更新`;
      filterStates.set(roi.id, state);
      if (state.pendingCount < 2) {
        return {
          sample: null,
          accepted: false,
          validationPassed: false,
          failureCount: state.failureCount,
          warning: state.lastWarning,
        };
      }
      warning = `${roi.name} 连续 ${state.pendingCount} 次接近，已接受跳变值`;
    }
  }

  if (roi.enableSmoothing) {
    const values = [...state.recentValues, next.value].slice(-5);
    next.value = Number(median(values).toFixed(roi.decimalPlaces));
    next.displayValue = next.value.toFixed(roi.decimalPlaces);
    state.recentValues = values;
  } else {
    state.recentValues = [next.value];
  }

  state.latestValid = next;
  state.failureCount = 0;
  state.pendingValue = undefined;
  state.pendingCount = 0;
  state.lastWarning = warning;
  next.warning = warning;
  filterStates.set(roi.id, state);
  return {
    sample: next,
    accepted: true,
    validationPassed: true,
    failureCount: 0,
    warning,
  };
}
