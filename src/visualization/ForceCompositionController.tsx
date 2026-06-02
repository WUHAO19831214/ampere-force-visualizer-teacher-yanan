import type { CompositionState, ForceScaleMode, ForceTriplet } from './ForceVisualization3D';
import { PhysicsSymbol, toUnicodePhysicsSymbol } from '../components/PhysicsSymbol';

interface ForceCompositionControllerProps {
  forces: ForceTriplet | null;
  waitingChannels: string[];
  isHoldingFrame: boolean;
  showResultOnly: boolean;
  showResultant: boolean;
  showMagneticForce: boolean;
  showMagneticAngle: boolean;
  magneticAngleText: string | null;
  showCurrentAngle: boolean;
  currentAngleText: string | null;
  currentDirectionSign: 1 | -1;
  animationRunning: boolean;
  compositionState: CompositionState;
  scaleFactor: number;
  forceScaleMode: ForceScaleMode;
  manualForceScale: number;
  minForceScale: number;
  maxForceScale: number;
  minVisibleArrowLength: number;
  hasMinVisibleAmplification: boolean;
  maxForce: number;
  maxArrowLength: number;
  showFieldLines: boolean;
  magneticStatusText: string;
  onTogglePause: () => void;
  onCompose: () => void;
  onToggleResultOnly: () => void;
  onToggleResultant: () => void;
  onToggleMagneticForce: () => void;
  onToggleMagneticForceAngle: () => void;
  onToggleCurrentMagneticForceAngle: () => void;
  onToggleCurrentDirection: () => void;
  onToggleFieldLines: () => void;
  onScaleModeChange: (mode: ForceScaleMode) => void;
  onManualScaleChange: (scale: number) => void;
  onAutoAdjustScale: () => void;
  onLockScale: () => void;
  onResetScale: () => void;
}

export function ForceCompositionController({
  forces,
  waitingChannels,
  isHoldingFrame,
  showResultOnly,
  showResultant,
  showMagneticForce,
  showMagneticAngle,
  magneticAngleText,
  showCurrentAngle,
  currentAngleText,
  currentDirectionSign,
  animationRunning,
  compositionState,
  scaleFactor,
  forceScaleMode,
  manualForceScale,
  minForceScale,
  maxForceScale,
  minVisibleArrowLength,
  hasMinVisibleAmplification,
  maxForce,
  maxArrowLength,
  showFieldLines,
  magneticStatusText,
  onTogglePause,
  onCompose,
  onToggleResultOnly,
  onToggleResultant,
  onToggleMagneticForce,
  onToggleMagneticForceAngle,
  onToggleCurrentMagneticForceAngle,
  onToggleCurrentDirection,
  onToggleFieldLines,
  onScaleModeChange,
  onManualScaleChange,
  onAutoAdjustScale,
  onLockScale,
  onResetScale,
}: ForceCompositionControllerProps) {
  const f12 = forces ? Math.sqrt(forces.f1 ** 2 + forces.f2 ** 2) : 0;
  const resultant = forces ? Math.sqrt(forces.f1 ** 2 + forces.f2 ** 2 + forces.f3 ** 2) : 0;

  return (
    <div className="force-control-panel">
      <div className="force-control-summary">
        <div className="force-summary-grid">
          <span>比例尺：1 N = {scaleFactor.toFixed(2)} 图示单位</span>
          <span>模式：{getScaleModeLabel(forceScaleMode)}</span>
          <span>
            <PhysicsSymbol symbol="F12" /> = {forces ? `${f12.toFixed(2)} N` : '-'}
          </span>
          <span>
            <PhysicsSymbol symbol="F" /> = {forces ? `${resultant.toFixed(2)} N` : '-'}
          </span>
          <span>状态：{getStateLabel(compositionState, animationRunning, showResultOnly)}</span>
          <span>磁场：{magneticStatusText}</span>
        </div>
        {waitingChannels.length > 0 && (
          <p>
            等待 OCR 数据：
            {waitingChannels.map((channel, index) => (
              <span key={channel}>
                {index > 0 && '、'}
                <PhysicsSymbol symbol={channel} />
              </span>
            ))}
          </p>
        )}
        {hasMinVisibleAmplification && <p>小于最小可见长度的非零力已放大显示，仅用于方向观察。</p>}
      </div>
      <div className="force-control-buttons">
        <button className={isHoldingFrame ? 'secondary-button is-active' : undefined} onClick={onTogglePause}>
          {isHoldingFrame ? '开始' : '暂停'}
        </button>
        <button onClick={onCompose} disabled={!forces || animationRunning}>
          三力合成
        </button>
        <button className={showResultOnly ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleResultOnly} disabled={!forces}>
          {showResultOnly ? '退出仅合力' : '仅合力'}
        </button>
        <button className={!showResultant ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleResultant} disabled={!forces}>
          {showResultant ? '隐藏合力' : '显示合力'}
        </button>
        <button className={showFieldLines ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleFieldLines}>
          {showFieldLines ? '隐藏磁感线' : '磁感线'}
        </button>
        <button className={showMagneticForce ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleMagneticForce}>
          {showMagneticForce ? '隐藏' : ''}
          <PhysicsSymbol symbol="F" />磁场力
        </button>
        <button className="secondary-button" onClick={onToggleCurrentDirection}>
          <PhysicsSymbol symbol="I" />：{currentDirectionSign === 1 ? '+x' : '-x'}
        </button>
        <div className="magnetic-angle-action">
          <button className={showMagneticAngle ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleMagneticForceAngle}>
            {showMagneticAngle ? (
              <>
                隐藏<PhysicsSymbol symbol="B" />-<PhysicsSymbol symbol="F" />角
              </>
            ) : (
              <>
                <PhysicsSymbol symbol="B" />-<PhysicsSymbol symbol="F" />夹角
              </>
            )}
          </button>
          {magneticAngleText && <output className="magnetic-angle-result">{magneticAngleText}</output>}
        </div>
        <div className="magnetic-angle-action">
          <button className={showCurrentAngle ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleCurrentMagneticForceAngle}>
            {showCurrentAngle ? (
              <>
                隐藏<PhysicsSymbol symbol="I" />-<PhysicsSymbol symbol="F" />角
              </>
            ) : (
              <>
                <PhysicsSymbol symbol="I" />-<PhysicsSymbol symbol="F" />夹角
              </>
            )}
          </button>
          {currentAngleText && <output className="magnetic-angle-result">{currentAngleText}</output>}
        </div>
      </div>
      <details className="force-scale-settings">
        <summary>力图示比例尺</summary>
        <div className="force-scale-controls">
          <label>
            比例尺模式
            <select value={forceScaleMode} onChange={(event) => onScaleModeChange(event.target.value as ForceScaleMode)}>
              <option value="auto">自动比例尺</option>
              <option value="manual">手动比例尺</option>
              <option value="locked">锁定比例尺</option>
            </select>
          </label>
          <label className="force-scale-slider">
            手动比例尺：1 N = {manualForceScale.toFixed(1)}
            <input
              type="range"
              min={minForceScale}
              max={maxForceScale}
              step={0.1}
              value={manualForceScale}
              disabled={forceScaleMode !== 'manual'}
              onChange={(event) => onManualScaleChange(Number(event.target.value))}
            />
          </label>
          <div className="force-scale-metrics">
            <span>当前：1 N = {scaleFactor.toFixed(2)} 图示单位</span>
            <span>最大力：{maxForce.toFixed(2)} N</span>
            <span>最大箭头：{maxArrowLength.toFixed(2)} 图示单位</span>
            <span>最小可见长度：{minVisibleArrowLength.toFixed(2)}</span>
          </div>
          <div className="force-scale-actions">
            <button type="button" onClick={onAutoAdjustScale}>
              自动调整比例尺
            </button>
            <button type="button" onClick={onLockScale}>
              锁定当前比例尺
            </button>
            <button type="button" className="secondary-button" onClick={onResetScale}>
              重置比例尺
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

function getStateLabel(state: CompositionState, animationRunning: boolean, showResultOnly: boolean) {
  if (showResultOnly) return '仅显示合力';
  if (animationRunning) {
    return state === 'compose12'
      ? `正在合成 ${toUnicodePhysicsSymbol('F1')} + ${toUnicodePhysicsSymbol('F2')}`
      : `正在合成 ${toUnicodePhysicsSymbol('F12')} + ${toUnicodePhysicsSymbol('F3')}`;
  }
  if (state === 'result') return '合成结果';
  return '实时三力图示';
}

function getScaleModeLabel(mode: ForceScaleMode) {
  if (mode === 'manual') return '手动';
  if (mode === 'locked') return '锁定';
  return '自动';
}
