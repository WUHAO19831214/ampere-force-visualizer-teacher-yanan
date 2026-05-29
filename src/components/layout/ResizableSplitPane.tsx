import type { ReactNode } from 'react';

interface ResizableSplitPaneProps {
  first: ReactNode;
  second: ReactNode;
  direction: 'horizontal' | 'vertical';
  firstSizePercent: number;
  onResize: (firstSizePercent: number) => void;
  minFirst?: number;
  minSecond?: number;
}

export function ResizableSplitPane({
  first,
  second,
  direction,
  firstSizePercent,
  onResize,
  minFirst = 18,
  minSecond = 18,
}: ResizableSplitPaneProps) {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = event.currentTarget.parentElement;
    if (!container) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const raw =
        direction === 'horizontal'
          ? ((moveEvent.clientX - rect.left) / rect.width) * 100
          : ((moveEvent.clientY - rect.top) / rect.height) * 100;
      onResize(Math.min(100 - minSecond, Math.max(minFirst, raw)));
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', cleanup);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', cleanup);
  };

  const secondSize = 100 - firstSizePercent;
  const isHorizontal = direction === 'horizontal';

  return (
    <div className={`split-pane ${isHorizontal ? 'split-horizontal' : 'split-vertical'}`}>
      <div
        className="split-child"
        style={{
          [isHorizontal ? 'width' : 'height']: `${firstSizePercent}%`,
        }}
      >
        {first}
      </div>
      <div
        className={`split-resizer ${isHorizontal ? 'split-resizer-x' : 'split-resizer-y'}`}
        onPointerDown={handlePointerDown}
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      />
      <div
        className="split-child"
        style={{
          [isHorizontal ? 'width' : 'height']: `${secondSize}%`,
        }}
      >
        {second}
      </div>
    </div>
  );
}
