import type { VisionRoiConfig } from '../types/vision';

interface VisionRoiBoxProps {
  roi: VisionRoiConfig;
  latestValue?: string;
  selected: boolean;
  onSelect: () => void;
  onChange: (roi: VisionRoiConfig) => void;
}

export function VisionRoiBox({ roi, latestValue, selected, onSelect, onChange }: VisionRoiBoxProps) {
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelect();
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const original = { ...roi };
    const move = (moveEvent: PointerEvent) => {
      onChange({
        ...original,
        x: Math.min(1 - original.width, Math.max(0, original.x + (moveEvent.clientX - startX) / rect.width)),
        y: Math.min(1 - original.height, Math.max(0, original.y + (moveEvent.clientY - startY) / rect.height)),
      });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cleanup);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cleanup);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
    const parent = event.currentTarget.parentElement?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const original = { ...roi };
    const move = (moveEvent: PointerEvent) => {
      onChange({
        ...original,
        width: Math.min(1 - original.x, Math.max(0.08, original.width + (moveEvent.clientX - startX) / rect.width)),
        height: Math.min(1 - original.y, Math.max(0.08, original.height + (moveEvent.clientY - startY) / rect.height)),
      });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cleanup);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cleanup);
  };

  return (
    <div
      className={`vision-roi-box ${selected ? 'selected' : ''} ${roi.enabled ? '' : 'disabled'}`}
      style={{ left: `${roi.x * 100}%`, top: `${roi.y * 100}%`, width: `${roi.width * 100}%`, height: `${roi.height * 100}%` }}
      onPointerDown={startDrag}
    >
      <div className="roi-label">
        <strong>{roi.name}</strong>
        <span>{roi.analyzerMethod}</span>
        <b>{latestValue ?? '-'}</b>
      </div>
      <button className="roi-resize-handle" onPointerDown={startResize} aria-label="缩放视觉 ROI" />
    </div>
  );
}
