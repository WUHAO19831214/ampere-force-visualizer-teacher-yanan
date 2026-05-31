import type { VisionRoiConfig, VisionSample } from '../types/vision';
import type { MagneticFieldDetectionResult } from '../types/vision';
import { VisionRoiBox } from './VisionRoiBox';

interface CameraOverlayProps {
  rois: VisionRoiConfig[];
  latestValues: Record<string, VisionSample>;
  magneticDetection?: MagneticFieldDetectionResult;
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (roi: VisionRoiConfig) => void;
}

export function CameraOverlay({ rois, latestValues, magneticDetection, selectedId, onSelect, onChange }: CameraOverlayProps) {
  return (
    <div className="overlay-layer camera-overlay-layer">
      <MagneticFieldOverlay detection={magneticDetection} />
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

function MagneticFieldOverlay({ detection }: { detection?: MagneticFieldDetectionResult }) {
  if (!detection?.frameWidth || !detection.frameHeight) return null;
  const nPole = detection.nPole ? toPercentPoint(detection.nPole.x, detection.nPole.y, detection.frameWidth, detection.frameHeight) : undefined;
  const sPole = detection.sPole ? toPercentPoint(detection.sPole.x, detection.sPole.y, detection.frameWidth, detection.frameHeight) : undefined;

  return (
    <div className="magnetic-camera-overlay">
      {nPole && (
        <div className="magnetic-marker magnetic-marker-n" style={{ left: `${nPole.x}%`, top: `${nPole.y}%` }}>
          <strong>N</strong>
          <span>
            {Math.round(detection.nPole?.x ?? 0)}, {Math.round(detection.nPole?.y ?? 0)}
          </span>
        </div>
      )}
      {sPole && (
        <div className="magnetic-marker magnetic-marker-s" style={{ left: `${sPole.x}%`, top: `${sPole.y}%` }}>
          <strong>S</strong>
          <span>
            {Math.round(detection.sPole?.x ?? 0)}, {Math.round(detection.sPole?.y ?? 0)}
          </span>
        </div>
      )}
      {nPole && sPole && (
        <svg className="magnetic-direction-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="magnetic-arrow-head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#79e4ff" />
            </marker>
          </defs>
          <line
            x1={nPole.x}
            y1={nPole.y}
            x2={sPole.x}
            y2={sPole.y}
            stroke="#79e4ff"
            strokeWidth="0.75"
            markerEnd="url(#magnetic-arrow-head)"
          />
          <text x={(nPole.x + sPole.x) / 2} y={(nPole.y + sPole.y) / 2 - 3} textAnchor="middle">
            B: N → S
          </text>
        </svg>
      )}
      {!nPole || !sPole ? <div className="magnetic-status-chip">{detection.warning ?? '等待 N/S 标记'}</div> : null}
    </div>
  );
}

function toPercentPoint(x: number, y: number, width: number, height: number) {
  return {
    x: (x / width) * 100,
    y: (y / height) * 100,
  };
}
