import { useEffect, useMemo, useRef, useState } from 'react';
import type { NumberRecognizer, RecognizerMethod, RoiConfig } from '../types/physics';
import { MockRecognizer } from '../recognizers/MockRecognizer';
import {
  getTesseractRuntimeStatus,
  subscribeTesseractRuntimeStatus,
  TesseractRecognizer,
  type TesseractRuntimeStatus,
} from '../recognizers/TesseractRecognizer';
import { CnnOnnxRecognizer } from '../recognizers/CnnOnnxRecognizer';
import { TemplateDigitRecognizer } from '../recognizers/TemplateDigitRecognizer';
import { cropRoiFromVideo } from '../utils/imagePreprocess';
import { preprocessForLangweiNumber } from '../utils/ocrPreprocess';
import { normalizeRecognizedNumber } from '../utils/numberPostprocess';
import { applyPhysicsDataFilters, getPhysicsFilterState, noteRecognitionFailure, resetDataFilters } from '../utils/dataFilter';
import { experimentDataActions, useExperimentDataStore } from '../store/useExperimentDataStore';
import { RoiOverlay } from './RoiOverlay';
import { RoiConfigPanel } from './RoiConfigPanel';
import { OcrDebugPanel } from './OcrDebugPanel';
import {
  getRenderedVideoRect,
  normalizedRectToVideoPixelRect,
  type ScreenViewMode,
  type Size,
} from '../utils/coordinateMapper';
import { setScreenCaptureVideoElement } from './screenCaptureRuntime';

const defaultRois: RoiConfig[] = [
  {
    id: 'roi-fy',
    channelId: 'Fy',
    name: 'Fy',
    symbol: 'Fy',
    unit: 'N',
    displayRoi: { x: 0.2, y: 0.52, width: 0.54, height: 0.08 },
    ocrRoi: { x: 0.36, y: 0.535, width: 0.28, height: 0.05 },
    decimalPlaces: 2,
    sampleRateHz: 2,
    recognizerMethod: 'tesseract',
    preprocessMode: 'color-number',
    roundingMode: 'round',
    psmMode: 'SINGLE_LINE',
    enableSmoothing: true,
    enableOutlierFilter: true,
    enabled: true,
    minValue: -20,
    maxValue: 20,
    maxDeltaPerSample: 5,
  },
  {
    id: 'roi-fz',
    channelId: 'Fz',
    name: 'Fz',
    symbol: 'Fz',
    unit: 'N',
    displayRoi: { x: 0.2, y: 0.62, width: 0.54, height: 0.08 },
    ocrRoi: { x: 0.36, y: 0.635, width: 0.28, height: 0.05 },
    decimalPlaces: 2,
    sampleRateHz: 2,
    recognizerMethod: 'tesseract',
    preprocessMode: 'color-number',
    roundingMode: 'round',
    psmMode: 'SINGLE_LINE',
    enableSmoothing: true,
    enableOutlierFilter: true,
    enabled: true,
    minValue: -20,
    maxValue: 20,
    maxDeltaPerSample: 5,
  },
];

function createFallbackImageData() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return context?.createImageData(8, 8) ?? new ImageData(8, 8);
}

export function ScreenCapturePanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const didInitializeRoisRef = useRef(false);
  const lastSampleAtRef = useRef<Record<string, number>>({});
  const busyRef = useRef<Record<string, boolean>>({});
  const roiStatsRef = useRef<Record<string, { startedAt: number; attempts: number }>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [showOcrRoi, setShowOcrRoi] = useState(true);
  const [viewMode, setViewMode] = useState<ScreenViewMode>('cover');
  const [containerSize, setContainerSize] = useState<Size>({ width: 1, height: 1 });
  const [videoSize, setVideoSize] = useState<Size>({ width: 16, height: 9 });
  const [sampleCount, setSampleCount] = useState(0);
  const [isTestingOcr, setIsTestingOcr] = useState(false);
  const [tesseractStatus, setTesseractStatus] = useState<TesseractRuntimeStatus>(() => getTesseractRuntimeStatus());
  const store = useExperimentDataStore();
  const { latestScreenValues, status } = store;
  const rois = store.screenRois.length > 0 ? store.screenRois : defaultRois;
  const selectedId = store.selectedScreenRoiId ?? rois[0]?.id;

  const recognizers = useMemo<Record<RecognizerMethod, NumberRecognizer>>(
    () => ({
      mock: new MockRecognizer(),
      tesseract: new TesseractRecognizer(),
      'cnn-onnx': new CnnOnnxRecognizer(),
      'template-digit': new TemplateDigitRecognizer(),
    }),
    [],
  );
  const tesseractRecognizer = recognizers.tesseract;

  const selectedRoi = rois.find((roi) => roi.id === selectedId);
  const renderedVideoRect = useMemo(
    () => getRenderedVideoRect(videoSize, containerSize, viewMode),
    [containerSize, videoSize, viewMode],
  );

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => subscribeTesseractRuntimeStatus(setTesseractStatus), []);

  useEffect(() => {
    if (didInitializeRoisRef.current) return;
    const hasLegacyRois = store.screenRois.some((roi) => ['F1', 'F2', 'F3'].includes(roi.channelId));
    const hasClassroomRois =
      store.screenRois.some((roi) => roi.channelId === 'Fy') && store.screenRois.some((roi) => roi.channelId === 'Fz');
    if (store.screenRois.length === 0 || hasLegacyRois || !hasClassroomRois) {
      didInitializeRoisRef.current = true;
      experimentDataActions.setScreenRois(defaultRois);
      experimentDataActions.setSelectedScreenRoiId(defaultRois[0].id);
    }
  }, [store.screenRois]);

  const updateVideoSize = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    setVideoSize({ width: video.videoWidth, height: video.videoHeight });
  };

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        updateVideoSize();
      }
      stream.getVideoTracks()[0]?.addEventListener('ended', stopCapture);
      setIsCapturing(true);
      experimentDataActions.updateStatus({ screenCapture: 'active', ocr: rois.some((roi) => roi.recognizerMethod === 'tesseract') ? 'ready' : 'mock' });
    } catch (error) {
      experimentDataActions.updateStatus({ screenCapture: 'error' });
      experimentDataActions.pushWarning(error instanceof Error ? error.message : '屏幕捕获授权失败');
    }
  };

  const stopCapture = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCapturing(false);
    resetDataFilters();
    lastSampleAtRef.current = {};
    busyRef.current = {};
    roiStatsRef.current = {};
    experimentDataActions.updateStatus({ screenCapture: 'stopped', actualScreenSampleRateHz: 0 });
  };

  useEffect(() => {
    experimentDataActions.updateStatus({ ocr: rois.some((roi) => roi.recognizerMethod === 'tesseract') ? 'ready' : 'mock' });
    rois.forEach((roi) => {
      const previous = status.screenRoiStatuses[roi.id];
      experimentDataActions.updateScreenRoiStatus(roi.id, {
        name: roi.name,
        symbol: roi.symbol,
        method: roi.recognizerMethod,
        enabled: roi.enabled,
        actualSampleRateHz: previous?.actualSampleRateHz ?? 0,
        durationMs: previous?.durationMs,
        failureCount: previous?.failureCount ?? 0,
        warning: previous?.warning,
      });
    });
  }, [rois]);

  useEffect(() => {
    if (!isCapturing) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      const video = videoRef.current;
      const now = performance.now();
      for (const roi of rois) {
        if (!roi.enabled) continue;
        if (busyRef.current[roi.id]) continue;
        const elapsed = now - (lastSampleAtRef.current[roi.id] ?? 0);
        if (elapsed < 1000 / Math.max(1, roi.sampleRateHz)) continue;
        lastSampleAtRef.current[roi.id] = now;
        busyRef.current[roi.id] = true;
          const recognizer = recognizers[roi.recognizerMethod];
        try {
          const cropped = video && video.videoWidth > 0 ? cropRoiFromVideo(video, roi.ocrRoi) : createFallbackImageData();
          const preprocessed = preprocessForLangweiNumber(cropped, roi.preprocessMode);
          const result = await recognizer.recognize({
            roiId: roi.id,
            method: roi.recognizerMethod,
            croppedImageData: cropped,
            preprocessedImageData: preprocessed,
            roiConfig: roi,
          });
          if (cancelled) return;
          const stats = roiStatsRef.current[roi.id] ?? { startedAt: performance.now(), attempts: 0 };
          stats.attempts += 1;
          roiStatsRef.current[roi.id] = stats;
          const actualSampleRateHz = Number((stats.attempts / Math.max(1, (performance.now() - stats.startedAt) / 1000)).toFixed(1));

          if (result.value === null) {
            const failureWarning = noteRecognitionFailure(roi);
            const warning = result.warning ?? failureWarning;
            const failureCount = getPhysicsFilterState(roi.id).failureCount;
          if (result.debug) {
            experimentDataActions.updateOcrDebug({
              ...result.debug,
              videoPixelRoi: normalizedRectToVideoPixelRect(roi.ocrRoi, {
                width: video?.videoWidth || videoSize.width,
                height: video?.videoHeight || videoSize.height,
              }),
              validationPassed: false,
                accepted: false,
                failureCount,
                warning,
              });
            }
            experimentDataActions.updateScreenRoiStatus(roi.id, {
              name: roi.name,
              symbol: roi.symbol,
              method: roi.recognizerMethod,
              enabled: roi.enabled,
              actualSampleRateHz,
              durationMs: result.durationMs,
              failureCount,
              warning,
            });
            experimentDataActions.pushWarning(warning);
            continue;
          }
          const normalized = normalizeRecognizedNumber(result.value, roi);
          const filterResult = applyPhysicsDataFilters(
            {
              roiId: roi.id,
              channelId: roi.channelId,
              name: roi.name,
              symbol: roi.symbol,
              unit: roi.unit,
              timestamp: Date.now(),
              value: normalized.value,
              displayValue: normalized.displayValue,
              rawValue: normalized.rawValue,
              rawText: result.rawText,
              confidence: result.confidence,
              durationMs: result.durationMs,
              method: result.method,
              source: 'screen-roi',
              warning: result.warning,
            },
            roi,
          );
          if (result.debug) {
            experimentDataActions.updateOcrDebug({
              ...result.debug,
              videoPixelRoi: normalizedRectToVideoPixelRect(roi.ocrRoi, {
                width: video?.videoWidth || videoSize.width,
                height: video?.videoHeight || videoSize.height,
              }),
              validationPassed: filterResult.validationPassed,
              accepted: filterResult.accepted,
              failureCount: filterResult.failureCount,
              warning: filterResult.warning ?? result.warning,
            });
          }
          experimentDataActions.updateScreenRoiStatus(roi.id, {
            name: roi.name,
            symbol: roi.symbol,
            method: roi.recognizerMethod,
            enabled: roi.enabled,
            actualSampleRateHz,
            durationMs: result.durationMs,
            failureCount: filterResult.failureCount,
            warning: filterResult.warning ?? result.warning,
          });
          if (filterResult.sample) {
            experimentDataActions.addScreenSample(filterResult.sample);
            setSampleCount((count) => count + 1);
          } else if (filterResult.warning) {
            experimentDataActions.pushWarning(filterResult.warning);
          }
        } catch (error) {
          noteRecognitionFailure(roi);
          const warning = error instanceof Error ? error.message : `${roi.name} 识别失败`;
          experimentDataActions.updateScreenRoiStatus(roi.id, {
            name: roi.name,
            symbol: roi.symbol,
            method: roi.recognizerMethod,
            enabled: roi.enabled,
            durationMs: undefined,
            failureCount: getPhysicsFilterState(roi.id).failureCount,
            warning,
          });
          experimentDataActions.pushWarning(warning);
        } finally {
          busyRef.current[roi.id] = false;
        }
      }
    }, 50);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isCapturing, rois, recognizers]);

  useEffect(() => {
    const started = performance.now();
    const interval = window.setInterval(() => {
      const seconds = Math.max(1, (performance.now() - started) / 1000);
      experimentDataActions.updateStatus({ actualScreenSampleRateHz: Number((sampleCount / seconds).toFixed(1)) });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sampleCount]);

  const updateRoi = (next: RoiConfig) => {
    const previous = rois.find((roi) => roi.id === next.id);
    experimentDataActions.updateScreenRoi(next);
    if (previous?.recognizerMethod !== next.recognizerMethod) {
      experimentDataActions.clearLatestScreenValue(next.channelId);
    }
  };

  const updateDebugFromResult = (
    roi: RoiConfig,
    result: Awaited<ReturnType<NumberRecognizer['recognize']>>,
    options: { video?: HTMLVideoElement | null; validationPassed?: boolean; accepted?: boolean; failureCount?: number; warning?: string },
  ) => {
    if (!result.debug) return;
    experimentDataActions.updateOcrDebug({
      ...result.debug,
      videoPixelRoi: normalizedRectToVideoPixelRect(roi.ocrRoi, {
        width: options.video?.videoWidth || videoSize.width,
        height: options.video?.videoHeight || videoSize.height,
      }),
      validationPassed: options.validationPassed,
      accepted: options.accepted,
      failureCount: options.failureCount,
      warning: options.warning ?? result.warning,
    });
  };

  const testCurrentRoiOcr = async () => {
    const roi = selectedRoi;
    const video = videoRef.current;
    if (!roi) return;
    if (!video?.videoWidth) {
      experimentDataActions.pushWarning('请先启动屏幕捕获，再测试当前 ROI OCR');
      return;
    }
    setIsTestingOcr(true);
    try {
      const cropped = cropRoiFromVideo(video, roi.ocrRoi);
      const preprocessed = preprocessForLangweiNumber(cropped, roi.preprocessMode);
      const testRoi: RoiConfig = { ...roi, recognizerMethod: 'tesseract' };
      const result = await tesseractRecognizer.recognize({
        roiId: roi.id,
        method: 'tesseract',
        croppedImageData: cropped,
        preprocessedImageData: preprocessed,
        roiConfig: testRoi,
      });
      const rangePassed =
        result.value !== null &&
        (roi.minValue === undefined || result.value >= roi.minValue) &&
        (roi.maxValue === undefined || result.value <= roi.maxValue);
      const warning =
        result.warning ??
        (result.value === null
          ? `${roi.name} 单次 OCR 测试未提取到数字`
          : rangePassed
            ? undefined
            : `${roi.name} 单次 OCR 测试值超出物理合理范围`);
      if (result.debug) {
        experimentDataActions.updateOcrDebug({
          ...result.debug,
          trigger: 'manual-test',
          videoPixelRoi: normalizedRectToVideoPixelRect(roi.ocrRoi, {
            width: video.videoWidth,
            height: video.videoHeight,
          }),
          validationPassed: rangePassed,
          accepted: false,
          failureCount: getPhysicsFilterState(roi.id).failureCount,
          warning,
        });
      }
      experimentDataActions.updateScreenRoiStatus(roi.id, {
        name: roi.name,
        symbol: roi.symbol,
        method: roi.recognizerMethod,
        enabled: roi.enabled,
        durationMs: result.durationMs,
        failureCount: getPhysicsFilterState(roi.id).failureCount,
        warning,
      });
      if (warning) experimentDataActions.pushWarning(warning);
    } finally {
      setIsTestingOcr(false);
    }
  };

  const addRoi = () => {
    const index = rois.length + 1;
    const next: RoiConfig = {
      id: `roi-${crypto.randomUUID()}`,
      channelId: `channel-${index}`,
      name: `物理量 ${index}`,
      symbol: `q${index}`,
      unit: '',
      displayRoi: { x: 0.18, y: 0.18, width: 0.38, height: 0.14 },
      ocrRoi: { x: 0.34, y: 0.21, width: 0.18, height: 0.07 },
      decimalPlaces: 2,
      sampleRateHz: 10,
      recognizerMethod: 'mock',
      preprocessMode: 'color-number',
      roundingMode: 'round',
      psmMode: 'SINGLE_LINE',
      enableSmoothing: false,
      enableOutlierFilter: true,
      enabled: true,
      minValue: -10,
      maxValue: 10,
      maxDeltaPerSample: 2,
    };
    experimentDataActions.setScreenRois([...rois, next]);
    experimentDataActions.setSelectedScreenRoiId(next.id);
  };

  return (
    <section className="panel panel-screen">
      <div className="panel-titlebar">
        <div>
          <h2>DIS实验数据读取区</h2>
          <p>读取数字化实验软件中的实时力数据</p>
        </div>
      </div>
      <div className="media-stage screen-preview-fixed" ref={previewRef}>
        <video
          ref={(node) => {
            videoRef.current = node;
            setScreenCaptureVideoElement(node);
          }}
          className="capture-video screen-capture-video"
          muted
          playsInline
          onLoadedMetadata={updateVideoSize}
          style={{
            left: `${renderedVideoRect.x}px`,
            top: `${renderedVideoRect.y}px`,
            width: `${renderedVideoRect.width}px`,
            height: `${renderedVideoRect.height}px`,
          }}
        />
        {!isCapturing && (
          <div className="stage-placeholder">
            <strong>尚未开始屏幕捕获</strong>
            <span>点击“开始捕获屏幕”，在浏览器授权窗口中选择实验软件窗口或屏幕。</span>
          </div>
        )}
        <RoiOverlay
          rois={rois}
          selectedId={selectedId}
          latestValues={latestScreenValues}
          showOcrRoi={showOcrRoi}
          style={{
            left: `${renderedVideoRect.x}px`,
            top: `${renderedVideoRect.y}px`,
            width: `${renderedVideoRect.width}px`,
            height: `${renderedVideoRect.height}px`,
          }}
          onSelect={experimentDataActions.setSelectedScreenRoiId}
          onChange={updateRoi}
        />
      </div>
      <div className="toolbar screen-toolbar panel-actions-below">
        <button onClick={startCapture} disabled={isCapturing}>
          开始捕获屏幕
        </button>
        <button onClick={stopCapture} disabled={!isCapturing}>
          停止捕获
        </button>
      </div>
      <div className="screen-bottom-scroll">
        <details className="config-drawer advanced-classroom-tools">
          <summary title="高级设置 / 调试工具">
            <span className="sr-only">高级设置 / 调试工具</span>
          </summary>
          <div className="advanced-tool-row">
            <button onClick={addRoi}>添加 ROI</button>
            <button onClick={() => experimentDataActions.setScreenRois([])}>清空 ROI</button>
            <button onClick={() => setShowOcrRoi((value) => !value)}>{showOcrRoi ? '隐藏 OCR 内框' : '显示 OCR 内框'}</button>
            <label className="toolbar-field">
              屏幕显示模式
              <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ScreenViewMode)}>
                <option value="contain">完整显示 contain</option>
                <option value="cover">填满显示 cover</option>
                <option value="manual-crop">手动裁剪 manual-crop</option>
              </select>
            </label>
          </div>
          <details className="nested-debug-drawer">
            <summary>屏幕 ROI 配置</summary>
            <RoiConfigPanel roi={selectedRoi} onChange={updateRoi} />
          </details>
          <OcrDebugPanel
            rois={rois}
            debugByRoi={status.ocrDebugByRoi}
            selectedId={selectedId}
            tesseractStatus={tesseractStatus}
            isTesting={isTestingOcr}
            onTestCurrentRoi={testCurrentRoiOcr}
          />
        </details>
      </div>
    </section>
  );
}
