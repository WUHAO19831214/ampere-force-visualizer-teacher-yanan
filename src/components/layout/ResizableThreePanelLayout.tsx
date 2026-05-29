import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_LAYOUT, loadLayoutRatios, saveLayoutRatios } from '../../utils/layoutStorage';

interface ResizableThreePanelLayoutProps {
  left: ReactNode;
  middle: ReactNode;
  rightTop: ReactNode;
  rightBottom: ReactNode;
}

export function ResizableThreePanelLayout({ left, middle, rightTop, rightBottom }: ResizableThreePanelLayoutProps) {
  const [layout, setLayout] = useState(() => loadLayoutRatios());

  useEffect(() => {
    saveLayoutRatios(layout);
  }, [layout]);

  const startHorizontalDrag = (divider: 'left-middle' | 'middle-right', event: React.PointerEvent<HTMLDivElement>) => {
    const container = event.currentTarget.parentElement;
    if (!container) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();

    const handleMove = (moveEvent: PointerEvent) => {
      const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setLayout((current) => {
        if (divider === 'left-middle') {
          const leftSize = Math.min(55, Math.max(18, x));
          const remaining = 100 - leftSize - current.right;
          const middleSize = Math.max(20, remaining);
          const rightSize = 100 - leftSize - middleSize;
          return { ...current, left: leftSize, middle: middleSize, right: rightSize };
        }
        const rightSize = Math.min(58, Math.max(24, 100 - x));
        const middleSize = Math.max(20, 100 - current.left - rightSize);
        const leftSize = 100 - middleSize - rightSize;
        return { ...current, left: leftSize, middle: middleSize, right: rightSize };
      });
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup);
  };

  const startVerticalDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = event.currentTarget.parentElement;
    if (!container) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();
    const handleMove = (moveEvent: PointerEvent) => {
      const top = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setLayout((current) => ({
        ...current,
        rightTop: Math.min(70, Math.max(32, top)),
        rightBottom: 100 - Math.min(70, Math.max(32, top)),
      }));
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup);
  };

  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  return (
    <main className="app-shell">
      <div className="app-header">
        <div>
          <h1>Physics Multi-Source Experiment Bridge</h1>
          <p>物理实验多源数据采集与三维可视化平台</p>
        </div>
        <button className="ghost-button" onClick={resetLayout}>
          重置布局
        </button>
      </div>
      <section className="three-panel-layout">
        <div className="layout-panel" style={{ width: `${layout.left}%` }}>
          {left}
        </div>
        <div
          className="panel-resizer panel-resizer-x"
          onPointerDown={(event) => startHorizontalDrag('left-middle', event)}
          role="separator"
          aria-label="调整左侧与中间宽度"
        />
        <div className="layout-panel" style={{ width: `${layout.middle}%` }}>
          {middle}
        </div>
        <div
          className="panel-resizer panel-resizer-x"
          onPointerDown={(event) => startHorizontalDrag('middle-right', event)}
          role="separator"
          aria-label="调整中间与右侧宽度"
        />
        <div className="layout-panel right-panel" style={{ width: `${layout.right}%` }}>
          <div className="right-top" style={{ height: `${layout.rightTop}%` }}>
            {rightTop}
          </div>
          <div
            className="panel-resizer panel-resizer-y"
            onPointerDown={startVerticalDrag}
            role="separator"
            aria-label="调整右侧上下高度"
          />
          <div className="right-bottom" style={{ height: `${layout.rightBottom}%` }}>
            {rightBottom}
          </div>
        </div>
      </section>
    </main>
  );
}
