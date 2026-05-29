import { useEffect, useMemo, useRef, useState } from 'react';
import type { VisionAnalyzer, VisionRoiConfig } from '../types/vision';
import { listVideoInputDevices, downloadCanvasAsPng } from '../utils/cameraUtils';
import { cropRoiFromVideo } from '../utils/imagePreprocess';
import { experimentDataActions, useExperimentDataStore } from '../store/useExperimentDataStore';
import { MockVisionAnalyzer } from '../vision/MockVisionAnalyzer';
import { ColorTrackingAnalyzer } from '../vision/ColorTrackingAnalyzer';
import { TemplateMatchingAnalyzer } from '../vision/TemplateMatchingAnalyzer';
import { MarkerTrackingAnalyzer } from '../vision/MarkerTrackingAnalyzer';
import { OpticalFlowAnalyzer } from '../vision/OpticalFlowAnalyzer';
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
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [visionRois, setVisionRois] = useState(defaultVisionRois);
  const [selectedId, setSelectedId] = useState(defaultVisionRois[0].id);
  const { latestVisionValues } = useExperimentDataStore();

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

  const updateRoi = (next: VisionRoiConfig) =>
    setVisionRois((current) => current.map((roi) => (roi.id === next.id ? next : roi)));

  const addVisionRoi = () => {
    const index = visionRois.length + 1;
    const next: VisionRoiConfig = {
      id: `vision-${crypto.randomUUID()}`,
      name: `视觉区域 ${index}`,
      x: 0.18,
      y: 0.18,
      width: 0.28,
      height: 0.22,
      analyzerMethod: 'mock',
      enabled: true,
    };
    setVisionRois((current) => [...current, next]);
    setSelectedId(next.id);
  };

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
          <h2>摄像头真实实验场景区</h2>
          <p>实时观察实验，预留视觉分析接口</p>
        </div>
      </div>
      <div className="toolbar">
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
        <button onClick={snapshot} disabled={!isCameraOn}>
          截取当前画面
        </button>
        <button onClick={addVisionRoi}>添加视觉分析区域</button>
        <button onClick={() => setVisionRois([])}>清空视觉分析区域</button>
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
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={updateRoi}
        />
      </div>
      <details className="config-drawer">
        <summary>摄像头视觉 ROI 配置</summary>
        <VisionConfigPanel roi={selectedRoi} onChange={updateRoi} />
      </details>
    </section>
  );
}
