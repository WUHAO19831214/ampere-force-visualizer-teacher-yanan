import type { PhysicsSample, RoiConfig } from '../types/physics';
import { RoiBox } from './RoiBox';
import type { CSSProperties } from 'react';

interface RoiOverlayProps {
  rois: RoiConfig[];
  selectedId?: string;
  latestValues: Record<string, PhysicsSample>;
  showOcrRoi: boolean;
  style?: CSSProperties;
  onSelect: (id: string) => void;
  onChange: (roi: RoiConfig) => void;
}

export function RoiOverlay({ rois, selectedId, latestValues, showOcrRoi, style, onSelect, onChange }: RoiOverlayProps) {
  return (
    <div className="overlay-layer" style={style}>
      {rois.map((roi) => {
        const latest = latestValues[roi.channelId];
        const matchingLatest = latest?.method === roi.recognizerMethod ? latest : undefined;
        return (
          <RoiBox
            key={roi.id}
            roi={roi}
            selected={selectedId === roi.id}
            showOcrRoi={showOcrRoi}
            latestValue={matchingLatest ? `${matchingLatest.value} ${roi.unit}` : undefined}
            statusText={matchingLatest?.warning ?? (roi.enabled ? roi.recognizerMethod : '已停用')}
            onSelect={() => onSelect(roi.id)}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}
