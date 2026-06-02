import type { Rect, RoiConfig } from '../types/physics';
import { PhysicsSymbol } from '../components/PhysicsSymbol';

interface RoiBoxProps {
  roi: RoiConfig;
  latestValue?: string;
  statusText: string;
  selected: boolean;
  showOcrRoi: boolean;
  onSelect: () => void;
  onChange: (roi: RoiConfig) => void;
}

function clampRectToUnit(rect: Rect): Rect {
  return {
    x: Math.min(1 - rect.width, Math.max(0, rect.x)),
    y: Math.min(1 - rect.height, Math.max(0, rect.y)),
    width: Math.min(1, Math.max(0.04, rect.width)),
    height: Math.min(1, Math.max(0.035, rect.height)),
  };
}

function clampRectInside(rect: Rect, parent: Rect): Rect {
  const width = Math.min(parent.width, Math.max(0.04, rect.width));
  const height = Math.min(parent.height, Math.max(0.035, rect.height));
  return {
    x: Math.min(parent.x + parent.width - width, Math.max(parent.x, rect.x)),
    y: Math.min(parent.y + parent.height - height, Math.max(parent.y, rect.y)),
    width,
    height,
  };
}

export function RoiBox({ roi, latestValue, statusText, selected, showOcrRoi, onSelect, onChange }: RoiBoxProps) {
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelect();
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const original = { ...roi };
    const originalDisplay = { ...roi.displayRoi };
    const originalOcr = { ...roi.ocrRoi };

    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / rect.width;
      const dy = (moveEvent.clientY - startY) / rect.height;
      const displayRoi = clampRectToUnit({
        ...originalDisplay,
        x: originalDisplay.x + dx,
        y: originalDisplay.y + dy,
      });
      const actualDx = displayRoi.x - originalDisplay.x;
      const actualDy = displayRoi.y - originalDisplay.y;
      onChange({
        ...original,
        displayRoi,
        ocrRoi: clampRectInside(
          {
            ...originalOcr,
            x: originalOcr.x + actualDx,
            y: originalOcr.y + actualDy,
          },
          displayRoi,
        ),
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
    const originalDisplay = { ...roi.displayRoi };
    const move = (moveEvent: PointerEvent) => {
      const dw = (moveEvent.clientX - startX) / rect.width;
      const dh = (moveEvent.clientY - startY) / rect.height;
      const displayRoi = clampRectToUnit({
        ...originalDisplay,
        width: Math.min(1 - originalDisplay.x, Math.max(0.08, originalDisplay.width + dw)),
        height: Math.min(1 - originalDisplay.y, Math.max(0.06, originalDisplay.height + dh)),
      });
      onChange({
        ...original,
        displayRoi,
        ocrRoi: clampRectInside(original.ocrRoi, displayRoi),
      });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cleanup);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cleanup);
  };

  const startOcrDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelect();
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const original = { ...roi };
    const originalOcr = { ...roi.ocrRoi };
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / rect.width;
      const dy = (moveEvent.clientY - startY) / rect.height;
      onChange({
        ...original,
        ocrRoi: clampRectInside(
          {
            ...originalOcr,
            x: originalOcr.x + dx,
            y: originalOcr.y + dy,
          },
          original.displayRoi,
        ),
      });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cleanup);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cleanup);
  };

  const startOcrResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
    const parent = event.currentTarget.parentElement?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const original = { ...roi };
    const originalOcr = { ...roi.ocrRoi };
    const move = (moveEvent: PointerEvent) => {
      const dw = (moveEvent.clientX - startX) / rect.width;
      const dh = (moveEvent.clientY - startY) / rect.height;
      onChange({
        ...original,
        ocrRoi: clampRectInside(
          {
            ...originalOcr,
            width: originalOcr.width + dw,
            height: originalOcr.height + dh,
          },
          original.displayRoi,
        ),
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
    <>
      <div
        className={`roi-box display-roi-box ${selected ? 'selected' : ''} ${roi.enabled ? '' : 'disabled'}`}
        style={{
          left: `${roi.displayRoi.x * 100}%`,
          top: `${roi.displayRoi.y * 100}%`,
          width: `${roi.displayRoi.width * 100}%`,
          height: `${roi.displayRoi.height * 100}%`,
        }}
        onPointerDown={startDrag}
      >
        <div className="roi-label">
          <strong>
            <PhysicsSymbol symbol={roi.name} />
          </strong>
          <span>
            <PhysicsSymbol symbol={roi.symbol} /> / {roi.unit}
          </span>
          <b>{latestValue ?? '-'}</b>
          <small>{statusText}</small>
        </div>
        <button className="roi-resize-handle" onPointerDown={startResize} aria-label="缩放显示 ROI" />
      </div>
      {showOcrRoi && (
        <div
          className={`roi-box ocr-roi-box ${selected ? 'selected' : ''} ${roi.enabled ? '' : 'disabled'}`}
          style={{
            left: `${roi.ocrRoi.x * 100}%`,
            top: `${roi.ocrRoi.y * 100}%`,
            width: `${roi.ocrRoi.width * 100}%`,
            height: `${roi.ocrRoi.height * 100}%`,
          }}
          onPointerDown={startOcrDrag}
          title="黄色框是 OCR 识别区域，只框住数字本身"
        >
          <span className="ocr-chip">OCR</span>
          <button className="roi-resize-handle" onPointerDown={startOcrResize} aria-label="缩放 OCR ROI" />
        </div>
      )}
    </>
  );
}
