import type { PreprocessMode, RecognizerMethod, RoiConfig, RoundingMode, TesseractPsmMode } from '../types/physics';

interface RoiConfigPanelProps {
  roi?: RoiConfig;
  onChange: (roi: RoiConfig) => void;
}

const recognizerMethods: RecognizerMethod[] = ['mock', 'tesseract', 'cnn-onnx', 'template-digit'];
const preprocessModes: PreprocessMode[] = ['auto', 'grayscale-threshold', 'high-contrast', 'invert', 'color-number'];
const roundingModes: RoundingMode[] = ['round', 'truncate'];
const psmModes: TesseractPsmMode[] = ['SINGLE_LINE', 'SINGLE_WORD', 'SINGLE_BLOCK'];

export function RoiConfigPanel({ roi, onChange }: RoiConfigPanelProps) {
  if (!roi) {
    return <div className="compact-empty">选择一个屏幕 ROI 后可调整识别配置。</div>;
  }

  const changeMethod = (method: RecognizerMethod) => {
    let sampleRateHz = roi.sampleRateHz;
    if (method === 'tesseract' && roi.recognizerMethod !== 'tesseract') sampleRateHz = 2;
    if (method === 'mock' && roi.recognizerMethod !== 'mock') sampleRateHz = 10;
    if ((method === 'cnn-onnx' || method === 'template-digit') && roi.recognizerMethod !== method) sampleRateHz = 10;
    onChange({ ...roi, recognizerMethod: method, sampleRateHz });
  };

  return (
    <div className="config-grid">
      <label>
        通道
        <input value={roi.channelId} onChange={(event) => onChange({ ...roi, channelId: event.target.value })} />
      </label>
      <label>
        名称
        <input value={roi.name} onChange={(event) => onChange({ ...roi, name: event.target.value })} />
      </label>
      <label>
        符号
        <input value={roi.symbol} onChange={(event) => onChange({ ...roi, symbol: event.target.value })} />
      </label>
      <label>
        单位
        <input value={roi.unit} onChange={(event) => onChange({ ...roi, unit: event.target.value })} />
      </label>
      <label>
        小数位
        <input
          type="number"
          min={0}
          max={6}
          value={roi.decimalPlaces}
          onChange={(event) => onChange({ ...roi, decimalPlaces: Number(event.target.value) })}
        />
      </label>
      <label>
        采样 Hz
        <input
          type="number"
          min={1}
          max={30}
          value={roi.sampleRateHz}
          onChange={(event) => onChange({ ...roi, sampleRateHz: Number(event.target.value) })}
        />
      </label>
      <label>
        识别方法
        <select value={roi.recognizerMethod} onChange={(event) => changeMethod(event.target.value as RecognizerMethod)}>
          {recognizerMethods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <label>
        预处理模式
        <select value={roi.preprocessMode} onChange={(event) => onChange({ ...roi, preprocessMode: event.target.value as PreprocessMode })}>
          {preprocessModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
      <label>
        显示策略
        <select value={roi.roundingMode} onChange={(event) => onChange({ ...roi, roundingMode: event.target.value as RoundingMode })}>
          {roundingModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode === 'round' ? '四舍五入 round' : '截断 truncate'}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tesseract PSM
        <select value={roi.psmMode} onChange={(event) => onChange({ ...roi, psmMode: event.target.value as TesseractPsmMode })}>
          {psmModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={roi.enabled} onChange={(event) => onChange({ ...roi, enabled: event.target.checked })} />
        启用
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={roi.enableSmoothing}
          onChange={(event) => onChange({ ...roi, enableSmoothing: event.target.checked })}
        />
        平滑滤波
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={roi.enableOutlierFilter}
          onChange={(event) => onChange({ ...roi, enableOutlierFilter: event.target.checked })}
        />
        异常跳变过滤
      </label>
      <label>
        最小值
        <input
          type="number"
          value={roi.minValue ?? ''}
          onChange={(event) => onChange({ ...roi, minValue: event.target.value === '' ? undefined : Number(event.target.value) })}
        />
      </label>
      <label>
        最大值
        <input
          type="number"
          value={roi.maxValue ?? ''}
          onChange={(event) => onChange({ ...roi, maxValue: event.target.value === '' ? undefined : Number(event.target.value) })}
        />
      </label>
      <label>
        单次最大跳变
        <input
          type="number"
          min={0}
          step={0.1}
          value={roi.maxDeltaPerSample ?? ''}
          onChange={(event) =>
            onChange({ ...roi, maxDeltaPerSample: event.target.value === '' ? undefined : Number(event.target.value) })
          }
        />
      </label>
      <label>
        OCR 坐标
        <input
          readOnly
          value={`${roi.ocrRoi.x.toFixed(3)}, ${roi.ocrRoi.y.toFixed(3)}, ${roi.ocrRoi.width.toFixed(3)}, ${roi.ocrRoi.height.toFixed(3)}`}
        />
      </label>
    </div>
  );
}
