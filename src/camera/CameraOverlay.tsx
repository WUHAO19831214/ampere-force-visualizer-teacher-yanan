import type { VisionRoiConfig, VisionSample } from '../types/vision';
import { VisionRoiBox } from './VisionRoiBox';

interface CameraOverlayProps {
  rois: VisionRoiConfig[];
  latestValues: Record<string, VisionSample>;
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (roi: VisionRoiConfig) => void;
}

export function CameraOverlay({ rois, latestValues, selectedId, onSelect, onChange }: CameraOverlayProps) {
  return (
    <div className="overlay-layer">
      {rois.map((roi) => {
        const latest = latestValues[roi.id];
        const text = latest ? `x ${latest.x ?? '-'} / y ${latest.y ?? '-'}` : undefined;
        return (
          <VisionRoiBox
            key={roi.id}
            roi={roi}
            latestValue={text}
            selected={selectedId === roi.id}
            onSelect={() => onSelect(roi.id)}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}
