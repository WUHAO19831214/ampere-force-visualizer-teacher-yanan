import type { PhysicsSample } from '../types/physics';
import type { RuntimeStatus } from '../types/experiment';

interface LiveScreenDataPanelProps {
  latestValues: Record<string, PhysicsSample>;
  roiStatuses?: RuntimeStatus['screenRoiStatuses'];
}

export function LiveScreenDataPanel({ latestValues, roiStatuses = {} }: LiveScreenDataPanelProps) {
  const statuses = Object.values(roiStatuses);
  const values =
    statuses.length > 0
      ? statuses.map((status) => {
          const sample = Object.values(latestValues).find((value) => value.symbol === status.symbol && value.method === status.method);
          return { status, sample };
        })
      : Object.values(latestValues).map((sample) => ({
          status: {
            name: sample.name,
            symbol: sample.symbol,
            method: sample.method,
            enabled: true,
          },
          sample,
        }));

  return (
    <section className="data-section classroom-screen-data">
      <h3>屏幕 ROI 数字识别数据</h3>
      <div className="live-grid">
        {values.length === 0 && <div className="compact-empty">等待屏幕 ROI 数据。</div>}
        {values.map(({ status, sample }) => {
          const methodText =
            status.method === 'cnn-onnx'
              ? 'cnn-onnx 未接入'
              : status.method === 'template-digit'
                ? 'template-digit 预留'
                : status.method;
          return (
            <article className="live-value-card" key={status.symbol}>
              <span>{status.name}</span>
              <strong>{sample ? `${sample.symbol} = ${sample.displayValue ?? sample.value} ${sample.unit}` : '等待 OCR'}</strong>
              <div className="live-meta">
                <span>来源：{methodText}</span>
                {sample?.rawText && <span>rawText：{sample.rawText}</span>}
                {sample?.confidence !== undefined && <span>置信度：{sample.confidence.toFixed(3)}</span>}
                {sample?.durationMs !== undefined && <span>耗时：{sample.durationMs} ms</span>}
                {!sample && <span>请确认屏幕捕获和 ROI 设置</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
