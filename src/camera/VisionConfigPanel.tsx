import type { VisionAnalyzerMethod, VisionRoiConfig } from '../types/vision';

interface VisionConfigPanelProps {
  roi?: VisionRoiConfig;
  onChange: (roi: VisionRoiConfig) => void;
}

const methods: VisionAnalyzerMethod[] = ['mock', 'color-tracking', 'template-matching', 'marker-tracking', 'optical-flow'];

export function VisionConfigPanel({ roi, onChange }: VisionConfigPanelProps) {
  if (!roi) return <div className="compact-empty">选择一个视觉 ROI 后可调整分析配置。</div>;

  return (
    <div className="config-grid">
      <label>
        名称
        <input value={roi.name} onChange={(event) => onChange({ ...roi, name: event.target.value })} />
      </label>
      <label>
        分析方法
        <select
          value={roi.analyzerMethod}
          onChange={(event) => onChange({ ...roi, analyzerMethod: event.target.value as VisionAnalyzerMethod })}
        >
          {methods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={roi.enabled} onChange={(event) => onChange({ ...roi, enabled: event.target.checked })} />
        启用
      </label>
    </div>
  );
}
