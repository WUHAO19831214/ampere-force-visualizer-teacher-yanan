import { useMemo, useState } from 'react';
import { CnnOnnxRecognizer } from '../recognizers/CnnOnnxRecognizer';
import { MockRecognizer } from '../recognizers/MockRecognizer';
import { TemplateDigitRecognizer } from '../recognizers/TemplateDigitRecognizer';
import { TesseractRecognizer } from '../recognizers/TesseractRecognizer';
import { getScreenCaptureVideoElement } from '../screen/screenCaptureRuntime';
import { experimentDataActions, useExperimentDataStore } from '../store/useExperimentDataStore';
import type { NumberRecognizer, OcrMethodTestResult, RecognizerMethod, RoiConfig } from '../types/physics';
import { normalizedRectToVideoPixelRect } from '../utils/coordinateMapper';
import { cropRoiFromVideo, imageDataToDataUrl } from '../utils/imagePreprocess';
import { preprocessForLangweiNumber } from '../utils/ocrPreprocess';

const methods: Array<{
  method: RecognizerMethod;
  title: string;
  description: string;
  testLabel: string;
}> = [
  {
    method: 'mock',
    title: 'Mock 模拟',
    description: '模拟数据，只用于对照，不代表真实 OCR 结果。',
    testLabel: '测试 Mock',
  },
  {
    method: 'tesseract',
    title: 'Tesseract OCR',
    description: '使用 Tesseract.js 本地识别当前 ROI 的预处理图。',
    testLabel: '测试 Tesseract',
  },
  {
    method: 'template-digit',
    title: 'Template Digit 模板匹配',
    description: '朗威固定字体模板匹配方案，适合后续优化高频稳定识别。',
    testLabel: '测试 Template Digit',
  },
  {
    method: 'cnn-onnx',
    title: 'CNN / ONNX 轻量模型',
    description: '轻量神经网络识别方案，后续可加载本地 ONNX 模型，不调用云端。',
    testLabel: '测试 CNN / ONNX',
  },
];

function sampleRateForMethod(method: RecognizerMethod) {
  return method === 'tesseract' ? 2 : 10;
}

function passesPhysicsCheck(value: number | null, roi: RoiConfig) {
  if (value === null) return false;
  if (roi.minValue !== undefined && value < roi.minValue) return false;
  if (roi.maxValue !== undefined && value > roi.maxValue) return false;
  return true;
}

function formatTime(timestamp?: number) {
  if (!timestamp) return '未测试';
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false });
}

export function OcrMethodComparisonPanel() {
  const store = useExperimentDataStore();
  const [busyMethod, setBusyMethod] = useState<RecognizerMethod | 'all' | null>(null);

  const recognizers = useMemo<Record<RecognizerMethod, NumberRecognizer>>(
    () => ({
      mock: new MockRecognizer(),
      tesseract: new TesseractRecognizer(),
      'template-digit': new TemplateDigitRecognizer(),
      'cnn-onnx': new CnnOnnxRecognizer(),
    }),
    [],
  );

  const rois = store.screenRois;
  const selectedRoi = rois.find((roi) => roi.id === store.selectedScreenRoiId) ?? rois[0];
  const results = selectedRoi ? store.ocrComparisonResults[selectedRoi.id] ?? {} : {};
  const latestPreview = Object.values(results)
    .filter(Boolean)
    .sort((a, b) => (b?.testedAt ?? 0) - (a?.testedAt ?? 0))[0];

  const runRecognizerWithImages = async (
    roi: RoiConfig,
    method: RecognizerMethod,
    croppedImageData: ImageData,
    preprocessedImageData: ImageData,
    video: HTMLVideoElement,
  ) => {
    const recognizer = recognizers[method];
    const testRoi = { ...roi, recognizerMethod: method };

    try {
      const result = await recognizer.recognize({
        roiId: roi.id,
        method,
        croppedImageData,
        preprocessedImageData,
        roiConfig: testRoi,
      });
      const passedPhysicsCheck = passesPhysicsCheck(result.value, roi);
      const warning =
        result.warning ??
        (result.value === null
          ? undefined
          : passedPhysicsCheck
            ? undefined
            : `${roi.name} 测试值超出物理合理范围`);
      const saved: OcrMethodTestResult = {
        roiId: roi.id,
        method,
        rawText: result.rawText,
        value: result.value,
        confidence: result.confidence,
        durationMs: result.durationMs,
        warning,
        error: result.error,
        passedPhysicsCheck,
        testedAt: result.testedAt,
        rawImageDataUrl: result.debug?.rawImageDataUrl ?? imageDataToDataUrl(croppedImageData),
        processedImageDataUrl: result.debug?.processedImageDataUrl ?? imageDataToDataUrl(preprocessedImageData),
        videoPixelRoi: normalizedRectToVideoPixelRect(roi.ocrRoi, {
          width: video.videoWidth,
          height: video.videoHeight,
        }),
      };
      experimentDataActions.setOcrComparisonResult(saved);
      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${roi.name} ${method} 测试失败`;
      const failed: OcrMethodTestResult = {
        roiId: roi.id,
        method,
        rawText: '',
        value: null,
        confidence: 0,
        durationMs: 0,
        error: message,
        warning: message,
        passedPhysicsCheck: false,
        testedAt: Date.now(),
        rawImageDataUrl: imageDataToDataUrl(croppedImageData),
        processedImageDataUrl: imageDataToDataUrl(preprocessedImageData),
        videoPixelRoi: normalizedRectToVideoPixelRect(roi.ocrRoi, {
          width: video.videoWidth,
          height: video.videoHeight,
        }),
      };
      experimentDataActions.setOcrComparisonResult(failed);
      experimentDataActions.pushWarning(message);
      return failed;
    }
  };

  const captureCurrentRoiImages = (roi: RoiConfig) => {
    const video = getScreenCaptureVideoElement();
    if (!video?.videoWidth) {
      const error = '请先启动屏幕捕获，再测试 OCR 方案';
      experimentDataActions.pushWarning(error);
      throw new Error(error);
    }

    const croppedImageData = cropRoiFromVideo(video, roi.ocrRoi);
    const preprocessedImageData = preprocessForLangweiNumber(croppedImageData, roi.preprocessMode);
    return { video, croppedImageData, preprocessedImageData };
  };

  const testOcrMethodOnce = async (roi: RoiConfig, method: RecognizerMethod) => {
    try {
      const { video, croppedImageData, preprocessedImageData } = captureCurrentRoiImages(roi);
      return await runRecognizerWithImages(roi, method, croppedImageData, preprocessedImageData, video);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${roi.name} ${method} 测试失败`;
      const failed: OcrMethodTestResult = {
        roiId: roi.id,
        method,
        rawText: '',
        value: null,
        confidence: 0,
        durationMs: 0,
        error: message,
        warning: message,
        passedPhysicsCheck: false,
        testedAt: Date.now(),
      };
      experimentDataActions.setOcrComparisonResult(failed);
      experimentDataActions.pushWarning(message);
      return failed;
    }
  };

  const testMethod = async (method: RecognizerMethod) => {
    if (!selectedRoi) return;
    setBusyMethod(method);
    try {
      await testOcrMethodOnce(selectedRoi, method);
    } finally {
      setBusyMethod(null);
    }
  };

  const testAllMethods = async () => {
    if (!selectedRoi) return;
    setBusyMethod('all');
    try {
      const { video, croppedImageData, preprocessedImageData } = captureCurrentRoiImages(selectedRoi);
      for (const item of methods) {
        await runRecognizerWithImages(selectedRoi, item.method, croppedImageData, preprocessedImageData, video);
      }
    } finally {
      setBusyMethod(null);
    }
  };

  const testAllRois = async () => {
    setBusyMethod('all');
    try {
      for (const roi of rois) {
        const { video, croppedImageData, preprocessedImageData } = captureCurrentRoiImages(roi);
        for (const item of methods) {
          await runRecognizerWithImages(roi, item.method, croppedImageData, preprocessedImageData, video);
        }
      }
    } finally {
      setBusyMethod(null);
    }
  };

  const adoptMethod = (method: RecognizerMethod) => {
    if (!selectedRoi) return;
    const next = {
      ...selectedRoi,
      recognizerMethod: method,
      sampleRateHz: sampleRateForMethod(method),
    };
    experimentDataActions.updateScreenRoi(next);
    experimentDataActions.clearLatestScreenValue(next.channelId);
    experimentDataActions.updateScreenRoiStatus(next.id, {
      name: next.name,
      symbol: next.symbol,
      method,
      enabled: next.enabled,
      actualSampleRateHz: 0,
      failureCount: 0,
      warning: `${next.name} 已采用 ${method} 作为实时识别方法，等待下一次采样`,
    });
  };

  if (!selectedRoi) {
    return (
      <section className="ocr-comparison-panel">
        <h3>OCR 方案对比</h3>
        <div className="compact-empty">暂无屏幕 ROI。请先在左侧添加或选择 ROI。</div>
      </section>
    );
  }

  const pixelRoi = latestPreview?.videoPixelRoi;

  return (
    <section className="ocr-comparison-panel">
      <div className="comparison-head">
        <div>
          <h3>OCR 方案对比</h3>
          <p>当前测试 ROI：{selectedRoi.name}</p>
        </div>
        <div className="comparison-actions">
          <button onClick={testAllMethods} disabled={busyMethod !== null}>
            测试全部 OCR 方法
          </button>
          <button onClick={testAllRois} disabled={busyMethod !== null || rois.length === 0}>
            测试全部 ROI
          </button>
        </div>
      </div>
      <div className="comparison-meta">
        <span>
          ocrRoi：x {selectedRoi.ocrRoi.x.toFixed(3)} / y {selectedRoi.ocrRoi.y.toFixed(3)} / w{' '}
          {selectedRoi.ocrRoi.width.toFixed(3)} / h {selectedRoi.ocrRoi.height.toFixed(3)}
        </span>
        <span>
          视频像素 ROI：
          {pixelRoi
            ? `x ${Math.round(pixelRoi.x)} / y ${Math.round(pixelRoi.y)} / w ${Math.round(pixelRoi.width)} / h ${Math.round(pixelRoi.height)}`
            : '尚未测试'}
        </span>
      </div>
      <div className="comparison-previews">
        <figure>
          {latestPreview?.rawImageDataUrl ? <img src={latestPreview.rawImageDataUrl} alt="当前裁剪图预览" /> : <div />}
          <figcaption>当前裁剪图</figcaption>
        </figure>
        <figure>
          {latestPreview?.processedImageDataUrl ? <img src={latestPreview.processedImageDataUrl} alt="当前预处理图预览" /> : <div />}
          <figcaption>当前预处理图</figcaption>
        </figure>
      </div>
      <div className="method-card-grid">
        {methods.map((item) => {
          const result = results[item.method];
          return (
            <article className={`method-card ${selectedRoi.recognizerMethod === item.method ? 'active-method-card' : ''}`} key={item.method}>
              <div className="method-card-title">
                <strong>{item.title}</strong>
                <span>{selectedRoi.recognizerMethod === item.method ? '实时使用中' : result ? '已测试' : '未测试'}</span>
              </div>
              <p>{item.description}</p>
              <dl>
                <div>
                  <dt>rawText</dt>
                  <dd>{result?.rawText || '-'}</dd>
                </div>
                <div>
                  <dt>value</dt>
                  <dd>{result?.value ?? '-'}</dd>
                </div>
                <div>
                  <dt>confidence</dt>
                  <dd>{result?.confidence?.toFixed(3) ?? '-'}</dd>
                </div>
                <div>
                  <dt>durationMs</dt>
                  <dd>{result ? `${result.durationMs} ms` : '-'}</dd>
                </div>
                <div>
                  <dt>物理校验</dt>
                  <dd>{result ? (result.passedPhysicsCheck ? '通过' : '未通过') : '-'}</dd>
                </div>
                <div>
                  <dt>最近测试</dt>
                  <dd>{formatTime(result?.testedAt)}</dd>
                </div>
              </dl>
              {(result?.warning || result?.error) && <div className="method-warning">{result.error ?? result.warning}</div>}
              <div className="method-actions">
                <button onClick={() => testMethod(item.method)} disabled={busyMethod !== null}>
                  {busyMethod === item.method || busyMethod === 'all' ? '测试中...' : item.testLabel}
                </button>
                <button onClick={() => adoptMethod(item.method)} disabled={selectedRoi.recognizerMethod === item.method}>
                  采用此方法作为实时识别方法
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
