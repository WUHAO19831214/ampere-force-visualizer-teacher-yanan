import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { VisionAnalyzer, VisionRoiConfig } from '../types/vision';
import { listVideoInputDevices, downloadCanvasAsPng } from '../utils/cameraUtils';
import { cropRoiFromVideo } from '../utils/imagePreprocess';
import { experimentDataActions, useExperimentDataStore } from '../store/useExperimentDataStore';
import { MockVisionAnalyzer } from '../vision/MockVisionAnalyzer';
import { ColorTrackingAnalyzer } from '../vision/ColorTrackingAnalyzer';
import { TemplateMatchingAnalyzer } from '../vision/TemplateMatchingAnalyzer';
import { MarkerTrackingAnalyzer } from '../vision/MarkerTrackingAnalyzer';
import { OpticalFlowAnalyzer } from '../vision/OpticalFlowAnalyzer';
import { MagneticFieldMarkerDetector } from '../vision/MagneticFieldMarkerDetector';
import { CameraOverlay } from './CameraOverlay';
import { VisionConfigPanel } from './VisionConfigPanel';

const defaultVisionRois: VisionRoiConfig[] = [
  {
    id: 'vision-target-1',
    name: '目标点',
    x: 0.28,
    y: 0.28,
    width: 0.28,
    height: 0.24,
    analyzerMethod: 'mock',
    enabled: true,
  },
];

function blankImageData() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return context?.createImageData(8, 8) ?? new ImageData(8, 8);
}

export function CameraCapturePanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const magneticFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [visionRois, setVisionRois] = useState(defaultVisionRois);
  const [selectedId, setSelectedId] = useState(defaultVisionRois[0].id);
  const { latestVisionValues, latestMagneticFieldDetection, magneticFieldConfig } = useExperimentDataStore();

  const analyzers = useMemo<Record<string, VisionAnalyzer>>(
    () => ({
      mock: new MockVisionAnalyzer(),
      'color-tracking': new ColorTrackingAnalyzer(),
      'template-matching': new TemplateMatchingAnalyzer(),
      'marker-tracking': new MarkerTrackingAnalyzer(),
      'optical-flow': new OpticalFlowAnalyzer(),
    }),
    [],
  );
  const magneticDetector = useMemo(() => new MagneticFieldMarkerDetector(), []);

  useEffect(() => {
    listVideoInputDevices().then(setDevices).catch(() => setDevices([]));
  }, [isCameraOn]);

  const selectedRoi = visionRois.find((roi) => roi.id === selectedId);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOn(true);
      experimentDataActions.updateStatus({ camera: 'active' });
      await listVideoInputDevices().then(setDevices);
    } catch (error) {
      experimentDataActions.updateStatus({ camera: 'error' });
      experimentDataActions.pushWarning(error instanceof Error ? error.message : '摄像头打开失败');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOn(false);
    experimentDataActions.updateStatus({ camera: 'stopped', cameraFps: 0, cameraResolution: '-' });
  };

  useEffect(() => {
    if (!isCameraOn) return;
    let frameCount = 0;
    let last = performance.now();
    let raf = 0;
    const loop = () => {
      frameCount += 1;
      const now = performance.now();
      if (now - last >= 1000) {
        const video = videoRef.current;
        experimentDataActions.updateStatus({
          cameraFps: Number(((frameCount * 1000) / (now - last)).toFixed(1)),
          cameraResolution: video?.videoWidth ? `${video.videoWidth} × ${video.videoHeight}` : '-',
        });
        frameCount = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isCameraOn]);

  useEffect(() => {
    if (!isCameraOn) return;
    const interval = window.setInterval(async () => {
      const video = videoRef.current;
      for (const roi of visionRois) {
        if (!roi.enabled) continue;
        const analyzer = analyzers[roi.analyzerMethod];
        try {
          const imageData = video && video.videoWidth > 0 ? cropRoiFromVideo(video, roi) : blankImageData();
          const result = await analyzer.analyze(imageData, roi);
          if (result.confidence <= 0 && result.warning) {
            experimentDataActions.pushWarning(result.warning);
            continue;
          }
          experimentDataActions.addVisionSample({
            roiId: roi.id,
            name: roi.name,
            timestamp: result.timestamp,
            x: result.x,
            y: result.y,
            angle: result.angle,
            displacement: result.displacement,
            velocity: result.velocity,
            angularVelocity: result.angularVelocity,
            confidence: result.confidence,
            method: result.method,
            source: 'camera-vision',
            warning: result.warning,
          });
        } catch (error) {
          experimentDataActions.pushWarning(error instanceof Error ? error.message : `${roi.name} 视觉分析失败`);
        }
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [isCameraOn, visionRois, analyzers]);

  useEffect(() => {
    if (!isCameraOn || !magneticFieldConfig.enabled || !magneticFieldConfig.detectionEnabled) return;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) return;
      try {
        const imageData = captureVideoFrame(video, magneticFrameCanvasRef);
        const result = magneticDetector.detect(imageData, magneticFieldConfig);
        experimentDataActions.updateMagneticFieldDetection(result);
      } catch (error) {
        experimentDataActions.pushWarning(error instanceof Error ? error.message : '磁场方向识别失败');
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [isCameraOn, magneticDetector, magneticFieldConfig]);

  const updateRoi = (next: VisionRoiConfig) =>
    setVisionRois((current) => current.map((roi) => (roi.id === next.id ? next : roi)));

  const snapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    downloadCanvasAsPng(canvas, `physics-camera-${Date.now()}.png`);
  };

  return (
    <section className="panel panel-camera">
      <div className="panel-titlebar">
        <div>
          <h2>磁场方向读取区</h2>
          <p>识别 N、S 极并读取磁场方向</p>
        </div>
      </div>
      <div className="media-stage">
        <video ref={videoRef} className="capture-video camera-video" muted playsInline />
        {!isCameraOn && (
          <div className="stage-placeholder">
            <strong>尚未打开摄像头</strong>
            <span>点击“打开摄像头”，授权后即可显示真实实验场景。</span>
          </div>
        )}
        <CameraOverlay
          rois={visionRois}
          latestValues={latestVisionValues}
          magneticDetection={latestMagneticFieldDetection}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={updateRoi}
        />
      </div>
      <div className="toolbar panel-actions-below">
        <button onClick={openCamera} disabled={isCameraOn}>
          打开摄像头
        </button>
        <button onClick={closeCamera} disabled={!isCameraOn}>
          关闭摄像头
        </button>
        <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} aria-label="选择摄像头设备">
          <option value="">默认摄像头</option>
          {devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `摄像头 ${index + 1}`}
            </option>
          ))}
        </select>
      </div>
      <details className="config-drawer advanced-classroom-tools">
        <summary title="高级设置 / 调试工具">
          <span className="sr-only">高级设置 / 调试工具</span>
        </summary>
        <div className="advanced-tool-row">
          <button onClick={snapshot} disabled={!isCameraOn}>
            截取当前画面
          </button>
        </div>
        <details className="nested-debug-drawer">
          <summary>摄像头视觉 ROI 配置</summary>
          <VisionConfigPanel roi={selectedRoi} onChange={updateRoi} />
        </details>
        <details className="nested-debug-drawer">
          <summary>磁场识别设置</summary>
          <MagneticFieldConfigPanel />
        </details>
      </details>
    </section>
  );
}

function captureVideoFrame(video: HTMLVideoElement, canvasRef: MutableRefObject<HTMLCanvasElement | null>) {
  const canvas = canvasRef.current ?? document.createElement('canvas');
  canvasRef.current = canvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('无法创建磁场识别画布');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function MagneticFieldConfigPanel() {
  const { magneticFieldConfig, latestMagneticFieldDetection } = useExperimentDataStore();
  const update = (next: Partial<typeof magneticFieldConfig>) => experimentDataActions.updateMagneticFieldConfig(next);
  const updateBlueThreshold = (next: Partial<typeof magneticFieldConfig.blueThreshold>) =>
    update({ blueThreshold: { ...magneticFieldConfig.blueThreshold, ...next } });
  const blueDebug = latestMagneticFieldDetection?.blueDebug;
  const blueThreshold = magneticFieldConfig.blueThreshold;

  return (
    <div className="config-grid magnetic-config-grid">
      <label className="check-row">
        <input
          type="checkbox"
          checked={magneticFieldConfig.detectionEnabled}
          onChange={(event) => update({ detectionEnabled: event.target.checked })}
        />
        启用磁极颜色识别
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={magneticFieldConfig.showFieldLines}
          onChange={(event) => update({ showFieldLines: event.target.checked })}
        />
        显示磁感线
      </label>
      <label>
        磁感线排数
        <input
          type="number"
          min={1}
          max={8}
          value={magneticFieldConfig.fieldLineRows}
          onChange={(event) => update({ fieldLineRows: Number(event.target.value) })}
        />
      </label>
      <label>
        磁感线列数
        <input
          type="number"
          min={1}
          max={8}
          value={magneticFieldConfig.fieldLineCols}
          onChange={(event) => update({ fieldLineCols: Number(event.target.value) })}
        />
      </label>
      <label>
        x 方向间距
        <input
          type="number"
          min={0.2}
          max={2}
          step={0.05}
          value={magneticFieldConfig.fieldLineXSpacing}
          onChange={(event) => update({ fieldLineXSpacing: Number(event.target.value) })}
        />
      </label>
      <label>
        y-z 侧向间距
        <input
          type="number"
          min={0.2}
          max={2}
          step={0.05}
          value={magneticFieldConfig.fieldLineSideSpacing}
          onChange={(event) => update({ fieldLineSideSpacing: Number(event.target.value) })}
        />
      </label>
      <label>
        磁感线长度
        <input
          type="number"
          min={1}
          max={8}
          step={0.1}
          value={magneticFieldConfig.fieldLineLength}
          onChange={(event) => update({ fieldLineLength: Number(event.target.value) })}
        />
      </label>
      <label>
        磁感线透明度
        <input
          type="number"
          min={0.18}
          max={0.58}
          step={0.02}
          value={magneticFieldConfig.fieldLineOpacity}
          onChange={(event) => update({ fieldLineOpacity: Number(event.target.value) })}
        />
      </label>
      <label>
        识别状态
        <output>
          N：{latestMagneticFieldDetection?.nPole ? '已识别' : '未识别'} / S：
          {latestMagneticFieldDetection?.sPole ? '已识别' : '未识别'}
        </output>
      </label>
      <div className="magnetic-debug-panel">
        <strong>蓝色 S 极识别状态</strong>
        <div className="magnetic-debug-list">
          <span>S 极：{latestMagneticFieldDetection?.sPole ? '已识别' : '未识别'}</span>
          <span>
            中心：
            {blueDebug?.center ? `${blueDebug.center.x.toFixed(1)}, ${blueDebug.center.y.toFixed(1)}` : '-'}
          </span>
          <span>最大连通区域：{blueDebug?.largestArea ?? 0}</span>
          <span>置信度：{(blueDebug?.confidence ?? 0).toFixed(3)}</span>
          <span>coreBlue：{blueDebug?.coreBluePixelCount ?? 0}</span>
          <span>looseBlue：{blueDebug?.looseBluePixelCount ?? 0}</span>
          <span>minArea：{blueDebug?.minArea ?? blueThreshold.minArea}</span>
          <span>状态：{blueDebug?.warning ?? (blueDebug?.retainedFromPrevious ? '短时保留上一帧 S 极' : '正常')}</span>
        </div>
      </div>
      <details className="magnetic-threshold-panel">
        <summary>蓝色阈值高级配置</summary>
        <div className="magnetic-threshold-grid">
          <ThresholdNumber label="核心 H min" value={blueThreshold.coreHueMin} onChange={(value) => updateBlueThreshold({ coreHueMin: value })} />
          <ThresholdNumber label="核心 H max" value={blueThreshold.coreHueMax} onChange={(value) => updateBlueThreshold({ coreHueMax: value })} />
          <ThresholdNumber label="核心 S min" step={0.01} value={blueThreshold.coreSaturationMin} onChange={(value) => updateBlueThreshold({ coreSaturationMin: value })} />
          <ThresholdNumber label="核心 V min" step={0.01} value={blueThreshold.coreValueMin} onChange={(value) => updateBlueThreshold({ coreValueMin: value })} />
          <ThresholdNumber label="核心 B min" value={blueThreshold.coreBMin} onChange={(value) => updateBlueThreshold({ coreBMin: value })} />
          <ThresholdNumber label="核心 B/R" step={0.01} value={blueThreshold.coreBlueDominanceR} onChange={(value) => updateBlueThreshold({ coreBlueDominanceR: value })} />
          <ThresholdNumber label="核心 B/G" step={0.01} value={blueThreshold.coreBlueDominanceG} onChange={(value) => updateBlueThreshold({ coreBlueDominanceG: value })} />
          <ThresholdNumber label="核心通道差" value={blueThreshold.coreMinChannelDiff} onChange={(value) => updateBlueThreshold({ coreMinChannelDiff: value })} />
          <ThresholdNumber label="宽松 H min" value={blueThreshold.looseHueMin} onChange={(value) => updateBlueThreshold({ looseHueMin: value })} />
          <ThresholdNumber label="宽松 H max" value={blueThreshold.looseHueMax} onChange={(value) => updateBlueThreshold({ looseHueMax: value })} />
          <ThresholdNumber label="宽松 S min" step={0.01} value={blueThreshold.looseSaturationMin} onChange={(value) => updateBlueThreshold({ looseSaturationMin: value })} />
          <ThresholdNumber label="宽松 V min" step={0.01} value={blueThreshold.looseValueMin} onChange={(value) => updateBlueThreshold({ looseValueMin: value })} />
          <ThresholdNumber label="宽松 B min" value={blueThreshold.looseBMin} onChange={(value) => updateBlueThreshold({ looseBMin: value })} />
          <ThresholdNumber label="宽松 B/R" step={0.01} value={blueThreshold.looseBlueDominanceR} onChange={(value) => updateBlueThreshold({ looseBlueDominanceR: value })} />
          <ThresholdNumber label="宽松 B/G" step={0.01} value={blueThreshold.looseBlueDominanceG} onChange={(value) => updateBlueThreshold({ looseBlueDominanceG: value })} />
          <ThresholdNumber label="宽松通道差" value={blueThreshold.looseMinChannelDiff} onChange={(value) => updateBlueThreshold({ looseMinChannelDiff: value })} />
          <ThresholdNumber label="S 极最小面积" value={blueThreshold.minArea} onChange={(value) => updateBlueThreshold({ minArea: value })} />
        </div>
      </details>
    </div>
  );
}

function ThresholdNumber({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
