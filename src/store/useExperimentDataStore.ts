import { useSyncExternalStore } from 'react';
import type { ExperimentDataStore, RuntimeStatus } from '../types/experiment';
import type { OcrMethodTestResult, PhysicsSample, RecognizerMethod, RoiConfig } from '../types/physics';
import type { MagneticFieldConfig, MagneticFieldDetectionResult, VisionSample } from '../types/vision';

interface StoreState extends ExperimentDataStore {
  status: RuntimeStatus;
}

const initialState: StoreState = {
  screenSamples: [],
  visionSamples: [],
  latestScreenValues: {},
  latestVisionValues: {},
  screenRois: [],
  selectedScreenRoiId: undefined,
  ocrComparisonResults: {},
  latestMagneticFieldDetection: undefined,
  magneticFieldConfig: {
    enabled: true,
    showFieldLines: false,
    detectionEnabled: true,
    redThreshold: {
      rMin: 150,
      gMax: 115,
      bMax: 115,
    },
    blueThreshold: {
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
    },
    fieldLineCount: 16,
    fieldLineRows: 4,
    fieldLineCols: 4,
    fieldLineLength: 4.6,
    fieldLineSpacing: 0.34,
    fieldLineXSpacing: 0.76,
    fieldLineSideSpacing: 0.76,
    fieldLineOpacity: 0.38,
    wirePosition3D: [0, 0, 0],
  },
  status: {
    screenCapture: 'idle',
    camera: 'idle',
    ocr: 'idle',
    cameraFps: 0,
    cameraResolution: '-',
    actualScreenSampleRateHz: 0,
    screenRoiStatuses: {},
    ocrDebugByRoi: {},
    warnings: [],
  },
};

let state = initialState;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(updater: (current: StoreState) => StoreState) {
  state = updater(state);
  emit();
}

function pushWarning(message?: string) {
  if (!message) return;
  setState((current) => ({
    ...current,
    status: {
      ...current.status,
      warnings: [message, ...current.status.warnings.filter((item) => item !== message)].slice(0, 8),
    },
  }));
}

export const experimentDataActions = {
  addScreenSample(sample: PhysicsSample) {
    setState((current) => ({
      ...current,
      screenSamples: [...current.screenSamples, sample].slice(-5000),
      latestScreenValues: {
        ...current.latestScreenValues,
        [sample.channelId]: sample,
      },
    }));
    pushWarning(sample.warning);
  },
  addVisionSample(sample: VisionSample) {
    setState((current) => ({
      ...current,
      visionSamples: [...current.visionSamples, sample].slice(-5000),
      latestVisionValues: {
        ...current.latestVisionValues,
        [sample.roiId]: sample,
      },
    }));
    pushWarning(sample.warning);
  },
  clearData() {
    setState((current) => ({
      ...current,
      screenSamples: [],
      visionSamples: [],
      latestScreenValues: {},
      latestVisionValues: {},
      ocrComparisonResults: {},
      status: { ...current.status, warnings: [] },
    }));
  },
  updateMagneticFieldDetection(result: MagneticFieldDetectionResult) {
    setState((current) => ({
      ...current,
      latestMagneticFieldDetection: result,
    }));
    pushWarning(result.warning);
  },
  updateMagneticFieldConfig(config: Partial<MagneticFieldConfig>) {
    setState((current) => ({
      ...current,
      magneticFieldConfig: {
        ...current.magneticFieldConfig,
        ...config,
      },
    }));
  },
  setScreenRois(rois: RoiConfig[]) {
    setState((current) => ({
      ...current,
      screenRois: rois,
      selectedScreenRoiId: current.selectedScreenRoiId ?? rois[0]?.id,
    }));
  },
  updateScreenRoi(roi: RoiConfig) {
    setState((current) => ({
      ...current,
      screenRois: current.screenRois.map((item) => (item.id === roi.id ? roi : item)),
    }));
  },
  setSelectedScreenRoiId(roiId: string) {
    setState((current) => ({
      ...current,
      selectedScreenRoiId: roiId,
    }));
  },
  clearLatestScreenValue(channelId: string) {
    setState((current) => {
      const nextLatest = { ...current.latestScreenValues };
      delete nextLatest[channelId];
      return {
        ...current,
        latestScreenValues: nextLatest,
      };
    });
  },
  setOcrComparisonResult(result: OcrMethodTestResult) {
    setState((current) => ({
      ...current,
      ocrComparisonResults: {
        ...current.ocrComparisonResults,
        [result.roiId]: {
          ...current.ocrComparisonResults[result.roiId],
          [result.method]: result,
        } as Partial<Record<RecognizerMethod, OcrMethodTestResult>>,
      },
    }));
  },
  updateStatus(status: Partial<RuntimeStatus>) {
    setState((current) => ({
      ...current,
      status: { ...current.status, ...status },
    }));
  },
  updateScreenRoiStatus(roiId: string, status: RuntimeStatus['screenRoiStatuses'][string]) {
    setState((current) => ({
      ...current,
      status: {
        ...current.status,
        screenRoiStatuses: {
          ...current.status.screenRoiStatuses,
          [roiId]: status,
        },
      },
    }));
  },
  updateOcrDebug(debug: RuntimeStatus['ocrDebugByRoi'][string]) {
    setState((current) => ({
      ...current,
      status: {
        ...current.status,
        ocrDebugByRoi: {
          ...current.status.ocrDebugByRoi,
          [debug.roiId]: debug,
        },
      },
    }));
  },
  pushWarning,
};

export function useExperimentDataStore() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}
