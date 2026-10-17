import type { VisionRoiConfig, VisionSample } from '../types/vision';
import type { MagneticFieldDetectionResult } from '../types/vision';
import { VisionRoiBox } from './VisionRoiBox';
import type { CSSProperties } from 'react';

interface CameraOverlayProps {
  style: CSSProperties;
  videoScale: number;
  rois: VisionRoiConfig[];
  latestValues: Record<string, VisionSample>;
  magneticDetection?: MagneticFieldDetectionResult;
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (roi: VisionRoiConfig) => void;
}

export function CameraOverlay({ style, videoScale, rois, latestValues, magneticDetection, selectedId, onSelect, onChange }: CameraOverlayProps) {
  const warning = magneticDetection?.frameWidth && magneticDetection.frameHeight && (!magneticDetection.nPole || !magneticDetection.sPole)
    ? magneticDetection.warning ?? '等待 N/S 标记'
    : null;
  return (
    <>
      <div className="overlay-layer camera-overlay-layer" style={style}>
        <MagneticFieldOverlay detection={magneticDetection} videoScale={videoScale} />
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
      {warning ? <div className="magnetic-status-chip">{warning}</div> : null}
    </>
  );
}

function MagneticFieldOverlay({ detection, videoScale }: { detection?: MagneticFieldDetectionResult; videoScale: number }) {
  if (!detection?.frameWidth || !detection.frameHeight) return null;
  const nMarker = detection.nPole;
  const sMarker = detection.sPole;
  const nPole = nMarker ? toPercentPoint(nMarker.x, nMarker.y, detection.frameWidth, detection.frameHeight) : undefined;
  const sPole = sMarker ? toPercentPoint(sMarker.x, sMarker.y, detection.frameWidth, detection.frameHeight) : undefined;

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
      {nMarker && sMarker && (
        <svg className="magnetic-direction-svg" viewBox={`0 0 ${detection.frameWidth} ${detection.frameHeight}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="magnetic-arrow-head" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#79e4ff" />
            </marker>
          </defs>
          <line
            x1={nMarker.x}
            y1={nMarker.y}
            x2={sMarker.x}
            y2={sMarker.y}
            stroke="#79e4ff"
            strokeWidth={4 / videoScale}
            markerEnd="url(#magnetic-arrow-head)"
          />
          <text
            x={(nMarker.x + sMarker.x) / 2}
            y={(nMarker.y + sMarker.y) / 2 - 24 / videoScale}
            textAnchor="middle"
            style={{ fontSize: 24 / videoScale, strokeWidth: 3 / videoScale }}
          >
            B: N → S
          </text>
        </svg>
      )}
    </div>
  );
}

function toPercentPoint(x: number, y: number, width: number, height: number) {
  return {
    x: (x / width) * 100,
    y: (y / height) * 100,
  };
}
