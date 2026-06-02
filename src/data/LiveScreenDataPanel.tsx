import type { PhysicsSample } from '../types/physics';
import type { RuntimeStatus } from '../types/experiment';
import { PhysicsSymbol } from '../components/PhysicsSymbol';

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
      <div className="live-grid">
        {values.length === 0 && <div className="compact-empty">等待屏幕 ROI 数据。</div>}
        {values.map(({ status, sample }) => (
          <article className="live-value-card" key={status.symbol}>
            <strong className="physics-reading">
              {sample ? (
                <>
                  <PhysicsSymbol symbol={sample.symbol} /> = {sample.displayValue ?? sample.value} {sample.unit}
                </>
              ) : (
                '等待 OCR'
              )}
            </strong>
            {!sample && <small>请确认屏幕捕获和 ROI 设置</small>}
          </article>
        ))}
      </div>
    </section>
  );
}
