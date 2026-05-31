import type { CompositionState, ForceTriplet } from './ForceVisualization3D';

interface ForceCompositionControllerProps {
  forces: ForceTriplet | null;
  waitingChannels: string[];
  isHoldingFrame: boolean;
  showResultOnly: boolean;
  animationRunning: boolean;
  compositionState: CompositionState;
  scaleFactor: number;
  showFieldLines: boolean;
  magneticStatusText: string;
  onTogglePause: () => void;
  onCompose: () => void;
  onToggleResultOnly: () => void;
  onToggleFieldLines: () => void;
}

export function ForceCompositionController({
  forces,
  waitingChannels,
  isHoldingFrame,
  showResultOnly,
  animationRunning,
  compositionState,
  scaleFactor,
  showFieldLines,
  magneticStatusText,
  onTogglePause,
  onCompose,
  onToggleResultOnly,
  onToggleFieldLines,
}: ForceCompositionControllerProps) {
  const f12 = forces ? Math.sqrt(forces.f1 ** 2 + forces.f2 ** 2) : 0;
  const resultant = forces ? Math.sqrt(forces.f1 ** 2 + forces.f2 ** 2 + forces.f3 ** 2) : 0;

  return (
    <div className="force-control-panel">
      <div className="force-control-summary">
        <h2>三力立体图示与合成演示</h2>
        <div className="force-summary-grid">
          <span>比例尺：1 N = {scaleFactor.toFixed(2)} scene unit</span>
          <span>F12 = {forces ? `${f12.toFixed(2)} N` : '-'}</span>
          <span>F = {forces ? `${resultant.toFixed(2)} N` : '-'}</span>
          <span>状态：{getStateLabel(compositionState, animationRunning, showResultOnly)}</span>
          <span>磁场：{magneticStatusText}</span>
        </div>
        {waitingChannels.length > 0 && <p>等待 OCR 数据：{waitingChannels.join('、')}</p>}
      </div>
      <div className="force-control-buttons">
        <button onClick={onTogglePause}>{isHoldingFrame ? '开始' : '暂停'}</button>
        <button onClick={onCompose} disabled={!forces || animationRunning}>
          三力合成
        </button>
        <button className={showResultOnly ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleResultOnly} disabled={!forces}>
          {showResultOnly ? '退出仅显示合力' : '仅显示合力'}
        </button>
        <button className={showFieldLines ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleFieldLines}>
          {showFieldLines ? '隐藏磁感线' : '显示磁感线'}
        </button>
      </div>
    </div>
  );
}

function getStateLabel(state: CompositionState, animationRunning: boolean, showResultOnly: boolean) {
  if (showResultOnly) return '仅显示合力';
  if (animationRunning) return state === 'compose12' ? '正在合成 F1 + F2' : '正在合成 F12 + F3';
  if (state === 'result') return '合成结果';
  return '实时三力图示';
}
