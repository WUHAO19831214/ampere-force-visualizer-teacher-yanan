import type { RuntimeStatus } from '../types/experiment';

interface StatusPanelProps {
  status: RuntimeStatus;
}

function statusText(value: RuntimeStatus[keyof RuntimeStatus]) {
  const map: Record<string, string> = {
    idle: '未启动',
    active: '运行中',
    stopped: '已停止',
    error: '错误',
    mock: 'Mock',
    ready: '就绪',
    warning: '警告',
  };
  return typeof value === 'string' ? map[value] ?? value : String(value);
}

export function StatusPanel({ status }: StatusPanelProps) {
  return (
    <section className="status-strip">
      <span>屏幕捕获：{statusText(status.screenCapture)}</span>
      <span>摄像头：{statusText(status.camera)}</span>
      <span>OCR 总状态：{statusText(status.ocr)}</span>
      <span>屏幕实际采样：{status.actualScreenSampleRateHz} Hz</span>
      <span>摄像头 FPS：{status.cameraFps}</span>
      <span>分辨率：{status.cameraResolution}</span>
      {Object.entries(status.screenRoiStatuses).map(([id, roiStatus]) => (
        <span key={id} title={roiStatus.warning}>
          {roiStatus.name}：{roiStatus.method}
          {roiStatus.actualSampleRateHz !== undefined ? ` / ${roiStatus.actualSampleRateHz} Hz` : ''}
          {roiStatus.durationMs !== undefined ? ` / ${roiStatus.durationMs} ms` : ''}
          {roiStatus.failureCount ? ` / 失败 ${roiStatus.failureCount}` : ''}
        </span>
      ))}
      {status.warnings.length > 0 && <strong title={status.warnings.join('\n')}>Warning：{status.warnings[0]}</strong>}
    </section>
  );
}
