import type { PhysicsSample } from '../types/physics';
import type { RuntimeStatus } from '../types/experiment';
import { PhysicsSymbol } from '../components/PhysicsSymbol';

interface LiveScreenDataPanelProps {
  latestValues: Record<string, PhysicsSample>;
  roiStatuses?: RuntimeStatus['screenRoiStatuses'];
}

export function LiveScreenDataPanel({ latestValues, roiStatuses = {} }: LiveScreenDataPanelProps) {
  const values = [
    { symbol: 'Fy', legacySymbols: ['Fy', 'F2'] },
    { symbol: 'Fz', legacySymbols: ['Fz', 'F3'] },
  ].map(({ symbol, legacySymbols }) => {
    const sample = Object.values(latestValues).find((value) =>
      legacySymbols.includes(value.symbol) || legacySymbols.includes(value.channelId) || legacySymbols.includes(value.name),
    );
    const status = Object.values(roiStatuses).find((item) => legacySymbols.includes(item.symbol) || legacySymbols.includes(item.name));
    return {
      status: {
        name: symbol,
        symbol,
        method: status?.method ?? sample?.method ?? 'tesseract',
        enabled: status?.enabled ?? true,
      },
      sample,
    };
  });

  return (
    <section className="data-section classroom-screen-data">
      <div className="live-grid">
        {values.map(({ status, sample }) => (
          <article className="live-value-card" key={status.symbol}>
            <strong className="physics-reading">
              {sample ? (
                <>
                  <PhysicsSymbol symbol={status.symbol} /> = {sample.displayValue ?? sample.value} {sample.unit}
                </>
              ) : (
                <>
                  <PhysicsSymbol symbol={status.symbol} />：等待 OCR
                </>
              )}
            </strong>
            {!sample && <small>请确认屏幕捕获和 ROI 设置</small>}
          </article>
        ))}
      </div>
    </section>
  );
}
