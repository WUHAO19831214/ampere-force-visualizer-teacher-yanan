import type { CompositionState, DirectionMetrics, ForceScaleMode, ForceTriplet, KeySnapshot } from './ForceVisualization3D';
import { PhysicsSymbol, toUnicodePhysicsSymbol } from '../components/PhysicsSymbol';

interface ForceCompositionControllerProps {
  forces: ForceTriplet | null;
  waitingChannels: string[];
  isHoldingFrame: boolean;
  showResultOnly: boolean;
  showResultant: boolean;
  showMagneticForce: boolean;
  showMagneticAngle: boolean;
  currentDirectionSign: 1 | -1;
  includeLeftHandRuleInSnapshot: boolean;
  autoSnapshotEnabled: boolean;
  keySnapshots: KeySnapshot[];
  directionMetrics: DirectionMetrics | null;
  perpendicularToleranceDeg: number;
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
  isViewLocked: boolean;
  onTogglePause: () => void;
  onCompose: () => void;
  onToggleResultOnly: () => void;
  onToggleResultant: () => void;
  onToggleMagneticForce: () => void;
  onToggleMagneticForceAngle: () => void;
  onToggleCurrentDirection: () => void;
  onToggleViewLock: () => void;
  onToggleIncludeLeftHandRule: () => void;
  onToggleAutoSnapshot: () => void;
  onManualSnapshot: () => void;
  onShowSixSnapshotGrid: () => void;
  onSelectSnapshot: (snapshot: KeySnapshot) => void;
  onClearSnapshots: () => void;
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
  currentDirectionSign,
  includeLeftHandRuleInSnapshot,
  autoSnapshotEnabled,
  keySnapshots,
  directionMetrics,
  perpendicularToleranceDeg,
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
  isViewLocked,
  onTogglePause,
  onCompose,
  onToggleResultOnly,
  onToggleResultant,
  onToggleMagneticForce,
  onToggleMagneticForceAngle,
  onToggleCurrentDirection,
  onToggleViewLock,
  onToggleIncludeLeftHandRule,
  onToggleAutoSnapshot,
  onManualSnapshot,
  onShowSixSnapshotGrid,
  onSelectSnapshot,
  onClearSnapshots,
  onToggleFieldLines,
  onScaleModeChange,
  onManualScaleChange,
  onAutoAdjustScale,
  onLockScale,
  onResetScale,
}: ForceCompositionControllerProps) {
  const resultant = forces ? Math.sqrt(forces.fx ** 2 + forces.fy ** 2 + forces.fz ** 2) : 0;

  return (
    <div className="force-control-panel">
      <div className="force-control-summary">
        <div className="force-summary-grid">
          <span>比例尺：1 N = {scaleFactor.toFixed(2)} 图示单位</span>
          <span>模式：{getScaleModeLabel(forceScaleMode)}</span>
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
          合力演示
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
          <PhysicsSymbol symbol="F磁场力" />
        </button>
        <button className="secondary-button" onClick={onToggleCurrentDirection}>
          <PhysicsSymbol symbol="I" />：{currentDirectionSign === 1 ? '+x' : '-x'}
        </button>
        <button className={isViewLocked ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleViewLock}>
          {isViewLocked ? '可旋转视角' : '固定视角'}
        </button>
        <div className="magnetic-angle-action">
          <button className={showMagneticAngle ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleMagneticForceAngle}>
            {showMagneticAngle ? (
              <>
                隐藏<PhysicsSymbol symbol="B" />-<PhysicsSymbol symbol="F磁场力" />角
              </>
            ) : (
              <>
                <PhysicsSymbol symbol="B" />-<PhysicsSymbol symbol="F磁场力" />夹角
              </>
            )}
          </button>
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
      <details className="key-snapshot-panel">
        <summary>关键图像记录</summary>
        <div className="snapshot-actions">
          <button type="button" onClick={onManualSnapshot} disabled={!forces}>
            手动截图
          </button>
          <button type="button" className={autoSnapshotEnabled ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleAutoSnapshot}>
            {autoSnapshotEnabled ? '关闭自动截图' : '自动截图'}
          </button>
          <button type="button" className={includeLeftHandRuleInSnapshot ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleIncludeLeftHandRule}>
            截图含左手：{includeLeftHandRuleInSnapshot ? '开' : '关'}
          </button>
          <button type="button" onClick={onShowSixSnapshotGrid} disabled={keySnapshots.length === 0}>
            六图展示
          </button>
          <button type="button" className="secondary-button" onClick={onClearSnapshots} disabled={keySnapshots.length === 0}>
            清空记录
          </button>
        </div>
        <div className="snapshot-thumb-list">
          {keySnapshots.length === 0 && <p>暂无关键图像。可手动截图，或开启自动截图记录满足垂直关系的关键画面。</p>}
          {keySnapshots.map((snapshot) => (
            <button type="button" className="snapshot-thumb" key={snapshot.id} onClick={() => onSelectSnapshot(snapshot)}>
              <img src={snapshot.imageDataUrl} alt={snapshot.name} />
              <span>
                <strong>{snapshot.name}</strong>
                <small>
                  {new Date(snapshot.createdAt).toLocaleTimeString()} · B-F {formatAngle(snapshot.angles.angleBF)} · I-F{' '}
                  {formatAngle(snapshot.angles.angleIF)}
                </small>
                <small>{snapshot.perpendicularPassed ? '垂直性：通过' : '垂直性：未满足'}</small>
              </span>
            </button>
          ))}
        </div>
      </details>
      {directionMetrics && <PerpendicularStatus metrics={directionMetrics} toleranceDeg={perpendicularToleranceDeg} />}
    </div>
  );
}

function PerpendicularStatus({ metrics, toleranceDeg }: { metrics: DirectionMetrics; toleranceDeg: number }) {
  return (
    <output className={metrics.perpendicularPassed ? 'perpendicular-status is-passed' : 'perpendicular-status'}>
      <strong>垂直性判断：{metrics.perpendicularPassed ? '通过' : '未满足'}</strong>
      <span>
        B-F：{formatAngle(metrics.angleBF)}；I-F：{formatAngle(metrics.angleIF)}；目标：90°±{toleranceDeg}°
      </span>
      <small>{metrics.perpendicularMessage.replace(/^垂直性判断：/, '')}</small>
    </output>
  );
}

function formatAngle(angle: number | undefined) {
  return typeof angle === 'number' ? `${angle.toFixed(1)}°` : '--';
}

function getStateLabel(state: CompositionState, animationRunning: boolean, showResultOnly: boolean) {
  if (showResultOnly) return '仅显示合力';
  if (animationRunning) {
    return state === 'compose12' ? `正在合成 ${toUnicodePhysicsSymbol('Fy')} 与 ${toUnicodePhysicsSymbol('Fz')}` : '正在显示合力';
  }
  if (state === 'result') return '合成结果';
  return '实时力图示';
}

function getScaleModeLabel(mode: ForceScaleMode) {
  if (mode === 'manual') return '手动';
  if (mode === 'locked') return '锁定';
  return '自动';
}
