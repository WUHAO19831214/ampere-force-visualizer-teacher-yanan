import type { VisionSample } from '../types/vision';

interface LiveVisionDataPanelProps {
  latestValues: Record<string, VisionSample>;
}

export function LiveVisionDataPanel({ latestValues }: LiveVisionDataPanelProps) {
  const values = Object.values(latestValues);
  return (
    <section className="data-section">
      <h3>摄像头视觉分析数据</h3>
      <div className="vision-list">
        {values.length === 0 && <div className="compact-empty">等待摄像头视觉数据。</div>}
        {values.map((sample) => (
          <article className="vision-row" key={sample.roiId}>
            <strong>{sample.name}</strong>
            <span>x: {sample.x ?? '-'}</span>
            <span>y: {sample.y ?? '-'}</span>
            <span>位移: {sample.displacement ?? '-'}</span>
            <span>角度: {sample.angle ?? '-'}</span>
            <span>速度: {sample.velocity ?? '-'}</span>
            <span>角速度: {sample.angularVelocity ?? '-'}</span>
            <span>置信度: {sample.confidence?.toFixed(2) ?? '-'}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
