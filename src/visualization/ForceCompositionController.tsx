import type { DirectionMetrics, ForceScaleMode, ForceTriplet, KeySnapshot } from './ForceVisualization3D';
import { PhysicsSymbol } from '../components/PhysicsSymbol';

interface ForceCompositionControllerProps {
  forces: ForceTriplet | null;
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
  scaleFactor: number;
  forceScaleMode: ForceScaleMode;
  manualForceScale: number;
  minForceScale: number;
  maxForceScale: number;
  minVisibleArrowLength: number;
  maxForce: number;
  maxArrowLength: number;
  showFieldLines: boolean;
  isViewLocked: boolean;
  isZyViewActive: boolean;
  onTogglePause: () => void;
  onCompose: () => void;
  onToggleResultOnly: () => void;
  onToggleResultant: () => void;
  onToggleMagneticForce: () => void;
  onToggleMagneticForceAngle: () => void;
  onToggleCurrentDirection: () => void;
  onToggleViewLock: () => void;
  onToggleZyView: () => void;
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
  scaleFactor,
  forceScaleMode,
  manualForceScale,
  minForceScale,
  maxForceScale,
  minVisibleArrowLength,
  maxForce,
  maxArrowLength,
  showFieldLines,
  isViewLocked,
  isZyViewActive,
  onTogglePause,
  onCompose,
  onToggleResultOnly,
  onToggleResultant,
  onToggleMagneticForce,
  onToggleMagneticForceAngle,
  onToggleCurrentDirection,
  onToggleViewLock,
  onToggleZyView,
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
  return (
    <div className="force-control-panel">
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
          <PhysicsSymbol symbol="F安培力" />
        </button>
        <button className="secondary-button" onClick={onToggleCurrentDirection}>
          <PhysicsSymbol symbol="I" />：{currentDirectionSign === 1 ? '+x' : '-x'}
        </button>
        <button className={isViewLocked ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleViewLock}>
          {isViewLocked ? '可旋转视角' : '固定视角'}
        </button>
        <button className={isZyViewActive ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleZyView}>
          {isZyViewActive ? '恢复立体视角' : 'Z-Y 正视图'}
        </button>
        <div className="magnetic-angle-action">
          <button className={showMagneticAngle ? 'secondary-button is-active' : 'secondary-button'} onClick={onToggleMagneticForceAngle}>
            {showMagneticAngle ? (
              <>
                隐藏<PhysicsSymbol symbol="B" />-<PhysicsSymbol symbol="F安培力" />角
              </>
            ) : (
              <>
                <PhysicsSymbol symbol="B" />-<PhysicsSymbol symbol="F安培力" />夹角
              </>
            )}
          </button>
        </div>
      </div>
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
            四图展示
          </button>
          <button type="button" className="secondary-button" onClick={onClearSnapshots} disabled={keySnapshots.length === 0}>
            清空记录
          </button>
        </div>
        <div className="snapshot-thumb-list">
          {keySnapshots.length === 0 && <p className="snapshot-empty-line">暂无关键图像。可手动截图，或开启自动截图记录满足垂直关系的关键画面。</p>}
          {keySnapshots.map((snapshot) => (
            <button type="button" className="snapshot-thumb" key={snapshot.id} onClick={() => onSelectSnapshot(snapshot)}>
              <img src={snapshot.imageDataUrl} alt={snapshot.name} />
              <span>
                <small className="snapshot-student-data">
                  I: {snapshot.currentDirection ?? '--'} / α：{formatAngle(snapshot.alphaDeg)} / β：{formatAngle(snapshot.betaDeg)}
                </small>
              </span>
            </button>
          ))}
        </div>
      </details>
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
      {directionMetrics && <PerpendicularStatus metrics={directionMetrics} toleranceDeg={perpendicularToleranceDeg} />}
    </div>
  );
}

function PerpendicularStatus({ metrics, toleranceDeg }: { metrics: DirectionMetrics; toleranceDeg: number }) {
  const message = metrics.perpendicularMessage.replace(/^垂直性判断：/, '');

  return (
    <output className={metrics.perpendicularPassed ? 'perpendicular-status is-passed' : 'perpendicular-status'}>
      <span>
        垂直性判断：{metrics.perpendicularPassed ? '通过' : '未满足'}；B-F：{formatAngle(metrics.angleBF)}；I-F：
        {formatAngle(metrics.angleIF)}；目标：90°±{toleranceDeg}°{message ? `；${message}` : ''}
      </span>
    </output>
  );
}

function formatAngle(angle: number | null | undefined) {
  return typeof angle === 'number' ? `${angle.toFixed(1)}°` : '--';
}
