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
  const [isRightPanelFullscreen, setIsRightPanelFullscreen] = useState(false);

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
        rightTop: Math.min(70, Math.max(12, top)),
        rightBottom: 100 - Math.min(70, Math.max(12, top)),
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
  const toggleLeftPanel = () => setLayout((current) => ({ ...current, leftCollapsed: !current.leftCollapsed }));

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
      <section className={`three-panel-layout ${isRightPanelFullscreen ? 'right-panel-fullscreen-layout' : ''}`}>
        {!isRightPanelFullscreen && !layout.leftCollapsed && (
          <>
            <div className="layout-panel left-layout-panel" style={{ width: `${layout.left}%` }}>
              {left}
              <button
                className="left-panel-collapse-toggle"
                onClick={toggleLeftPanel}
                aria-label="收起屏幕 ROI 数字读取区"
                title="收起屏幕 ROI 数字读取区"
              >
                ‹
              </button>
            </div>
            <div
              className="panel-resizer panel-resizer-x"
              onPointerDown={(event) => startHorizontalDrag('left-middle', event)}
              role="separator"
              aria-label="调整左侧与中间宽度"
            />
          </>
        )}
        {!isRightPanelFullscreen && layout.leftCollapsed && (
          <div className="left-panel-collapsed-rail">
            <button
              className="left-panel-expand-toggle"
              onClick={toggleLeftPanel}
              aria-label="展开屏幕 ROI 数字读取区"
              title="展开屏幕 ROI 数字读取区"
            >
              ›
            </button>
          </div>
        )}
        {!isRightPanelFullscreen && (
          <>
            <div className={`layout-panel ${layout.leftCollapsed ? 'balanced-layout-panel' : ''}`} style={layout.leftCollapsed ? undefined : { width: `${layout.middle}%` }}>
              {middle}
            </div>
            <div
              className="panel-resizer panel-resizer-x"
              onPointerDown={(event) => startHorizontalDrag('middle-right', event)}
              role="separator"
              aria-label="调整中间与右侧宽度"
            />
          </>
        )}
        <div
          className={`layout-panel right-panel ${layout.leftCollapsed && !isRightPanelFullscreen ? 'balanced-layout-panel' : ''} ${isRightPanelFullscreen ? 'right-panel-fullscreen-active' : ''}`}
          style={isRightPanelFullscreen || layout.leftCollapsed ? undefined : { width: `${layout.right}%` }}
        >
          <button
            className="right-fullscreen-toggle secondary-button"
            onClick={() => setIsRightPanelFullscreen((current) => !current)}
          >
            {isRightPanelFullscreen ? '恢复布局' : '全屏展示'}
          </button>
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
