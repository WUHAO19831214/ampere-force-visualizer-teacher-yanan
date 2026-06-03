import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useExperimentDataStore } from '../store/useExperimentDataStore';
import { experimentDataActions } from '../store/useExperimentDataStore';
import type { PhysicsSample } from '../types/physics';
import type { MagneticFieldConfig, MagneticFieldDetectionResult } from '../types/vision';
import { PhysicsSymbol, toUnicodePhysicsSymbol } from '../components/PhysicsSymbol';
import { createDashedLine, createForceArrowGroup, createTextSprite, disposeObject3D } from './ForceArrow3D';
import { ForceCompositionController } from './ForceCompositionController';
import { createMagneticFieldLinesGroup, getMagneticFieldDirection3D } from './MagneticFieldLines3D';

export type CompositionState = 'idle' | 'compose12' | 'compose123' | 'result';
export type ForceScaleMode = 'auto' | 'manual' | 'locked';

export interface ForceTriplet {
  f1: number;
  f2: number;
  f3: number;
  timestamp: number;
}

export interface KeySnapshot {
  id: string;
  name: string;
  source: 'manual' | 'auto';
  imageDataUrl: string;
  createdAt: number;
  forces: {
    f1: number;
    f2: number;
    f3: number;
    fSensorMagnitude: number;
    fMagneticMagnitude: number;
  };
  directions: {
    currentDirection: [number, number, number];
    magneticFieldDirection?: [number, number, number];
    magneticForceDirection?: [number, number, number];
  };
  angles: {
    angleBF?: number;
    angleIF?: number;
  };
  perpendicularPassed: boolean;
}

export interface DirectionMetrics {
  fSensorMagnitude: number;
  fMagneticMagnitude: number;
  currentDirection: [number, number, number];
  magneticFieldDirection?: [number, number, number];
  magneticForceDirection?: [number, number, number];
  angleBF?: number;
  angleIF?: number;
  perpendicularPassed: boolean;
  perpendicularMessage: string;
}

const COMPONENT_COLOR = '#36d4cb';
const F12_COLOR = '#f6a72f';
const RESULT_COLOR = '#ff5c45';
const MAGNETIC_FORCE_COLOR = '#a78bfa';
const CURRENT_COLOR = '#facc15';
const IB_PLANE_COLOR = '#9fb7ff';
const LEFT_HAND_COLOR = '#f7d6b5';
const HELPER_COLOR = '#d9e2ec';
const AXIS_COLOR = '#aeb8c4';
const DEFAULT_MANUAL_FORCE_SCALE = 5;
const MIN_FORCE_SCALE = 0.2;
const MAX_FORCE_SCALE = 30;
const TARGET_MAX_ARROW_LENGTH = 3;
const MIN_VISIBLE_ARROW_LENGTH = 0.25;
const AUTO_SCALE_SMOOTHING_WEIGHT = 0.2;
const PERPENDICULAR_TOLERANCE_DEG = 8;
const MAX_KEY_SNAPSHOTS = 6;
const FORCE_VISUALIZATION_SPLIT_STORAGE_KEY = 'physics-force-visualization-split-ratio';
const DEFAULT_VISUALIZATION_SPLIT_RATIO = 0.68;
const MIN_VISUALIZATION_SPLIT_RATIO = 0.45;
const MAX_VISUALIZATION_SPLIT_RATIO = 0.82;

export function ForceVisualization3D() {
  const store = useExperimentDataStore();
  const { latestMagneticFieldDetection, magneticFieldConfig } = store;
  const latestForces = useMemo(() => readTesseractForces(store.latestScreenValues), [store.latestScreenValues]);
  const waitingChannels = useMemo(() => getWaitingChannels(store.latestScreenValues), [store.latestScreenValues]);
  const [displayForces, setDisplayForces] = useState<ForceTriplet | null>(latestForces);
  const [heldForces, setHeldForces] = useState<ForceTriplet | null>(null);
  const [animationForces, setAnimationForces] = useState<ForceTriplet | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showResultOnly, setShowResultOnly] = useState(false);
  const [showResultant, setShowResultant] = useState(true);
  const [showMagneticForce, setShowMagneticForce] = useState(false);
  const [showMagneticAngle, setShowMagneticAngle] = useState(false);
  const [showCurrentAngle, setShowCurrentAngle] = useState(false);
  const [currentDirectionSign, setCurrentDirectionSign] = useState<1 | -1>(1);
  const [showIBPlane, setShowIBPlane] = useState(false);
  const [showLeftHandRule, setShowLeftHandRule] = useState(false);
  const [includeLeftHandRuleInSnapshot, setIncludeLeftHandRuleInSnapshot] = useState(false);
  const [autoSnapshotEnabled, setAutoSnapshotEnabled] = useState(false);
  const [keySnapshots, setKeySnapshots] = useState<KeySnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<KeySnapshot | null>(null);
  const [showSixSnapshotGrid, setShowSixSnapshotGrid] = useState(false);
  const [animationRunning, setAnimationRunning] = useState(false);
  const [compositionState, setCompositionState] = useState<CompositionState>('idle');
  const [animationProgress, setAnimationProgress] = useState(0);
  const [forceScaleMode, setForceScaleMode] = useState<ForceScaleMode>('auto');
  const [manualForceScale, setManualForceScale] = useState(DEFAULT_MANUAL_FORCE_SCALE);
  const [autoForceScale, setAutoForceScale] = useState(DEFAULT_MANUAL_FORCE_SCALE);
  const [lockedForceScale, setLockedForceScale] = useState<number | null>(null);
  const [heldForceScale, setHeldForceScale] = useState<number | null>(null);
  const [animationForceScale, setAnimationForceScale] = useState<number | null>(null);
  const [visualizationSplitRatio, setVisualizationSplitRatio] = useState(readStoredVisualizationSplitRatio);
  const autoScaleInitializedRef = useRef(false);
  const visualizationPanelRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastAutoSnapshotAtRef = useRef(0);
  const snapshotCountersRef = useRef({ manual: 0, auto: 0 });

  useEffect(() => {
    if (!isPaused && !animationForces && latestForces) {
      setDisplayForces(latestForces);
    }
  }, [animationForces, isPaused, latestForces]);

  useEffect(() => {
    if (!animationRunning) return;
    const startedAt = performance.now();
    const durationMs = 6800;
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      setAnimationProgress(progress);
      if (progress < 0.47) {
        setCompositionState('compose12');
      } else if (progress < 0.94) {
        setCompositionState('compose123');
      } else {
        setCompositionState('result');
      }

      if (progress >= 1) {
        setAnimationRunning(false);
        setAnimationProgress(1);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [animationRunning]);

  const activeForces = animationForces ?? (isPaused ? heldForces : displayForces ?? latestForces);
  const isHoldingFrame = isPaused || animationForces !== null;
  const selectedForceScale =
    forceScaleMode === 'manual'
      ? manualForceScale
      : forceScaleMode === 'locked'
        ? lockedForceScale ?? autoForceScale
        : autoForceScale;
  const scaleFactor = animationForceScale ?? (isPaused ? heldForceScale ?? selectedForceScale : selectedForceScale);
  const maxForce = getMaxForceMagnitude(activeForces);
  const maxArrowLength = maxForce * scaleFactor;
  const hasMinVisibleAmplification = shouldApplyMinimumVisibleLength(activeForces, scaleFactor, MIN_VISIBLE_ARROW_LENGTH);
  const magneticAngleText = showMagneticAngle
    ? getMagneticForceAngleText(activeForces, latestMagneticFieldDetection)
    : null;
  const currentAngleText = showCurrentAngle
    ? getCurrentMagneticForceAngleText(activeForces, currentDirectionSign)
    : null;
  const directionMetrics = useMemo(
    () => getDirectionMetrics(activeForces, latestMagneticFieldDetection, currentDirectionSign, PERPENDICULAR_TOLERANCE_DEG),
    [activeForces, currentDirectionSign, latestMagneticFieldDetection],
  );

  useEffect(() => {
    if (forceScaleMode !== 'auto' || isPaused || animationForces || !latestForces) return;
    const targetScale = computeAutoForceScale(getForceMagnitudes(latestForces));
    setAutoForceScale((currentScale) => {
      if (!autoScaleInitializedRef.current) {
        autoScaleInitializedRef.current = true;
        return targetScale;
      }
      return currentScale * (1 - AUTO_SCALE_SMOOTHING_WEIGHT) + targetScale * AUTO_SCALE_SMOOTHING_WEIGHT;
    });
  }, [animationForces, forceScaleMode, isPaused, latestForces]);

  useEffect(() => {
    if (animationRunning || compositionState !== 'result' || isPaused || !animationForces) return;
    setAnimationForces(null);
    setAnimationForceScale(null);
  }, [animationForces, animationRunning, compositionState, isPaused]);

  useEffect(() => {
    if (!autoSnapshotEnabled || !activeForces || !directionMetrics?.perpendicularPassed) return;
    if (!directionMetrics.magneticFieldDirection || !directionMetrics.magneticForceDirection) return;
    if (keySnapshots.length >= MAX_KEY_SNAPSHOTS) return;
    const now = Date.now();
    if (now - lastAutoSnapshotAtRef.current < 2000) return;
    lastAutoSnapshotAtRef.current = now;
    void captureKeySnapshot('auto');
  }, [activeForces, autoSnapshotEnabled, directionMetrics, keySnapshots.length]);

  const handleTogglePause = () => {
    if (isHoldingFrame) {
      setIsPaused(false);
      setHeldForces(null);
      setAnimationForces(null);
      setHeldForceScale(null);
      setAnimationForceScale(null);
      setAnimationRunning(false);
      setCompositionState('idle');
      setAnimationProgress(0);
      if (latestForces) setDisplayForces(latestForces);
      return;
    }
    setIsPaused(true);
    setHeldForces(activeForces ?? latestForces ?? null);
    setHeldForceScale(scaleFactor);
  };

  const handleCompose = () => {
    const baseForces = activeForces ?? latestForces;
    if (!baseForces) return;
    setShowResultOnly(false);
    setAnimationForces(baseForces);
    setAnimationForceScale(scaleFactor);
    setAnimationProgress(0);
    setCompositionState('compose12');
    setAnimationRunning(true);
  };

  const handleToggleResultOnly = () => {
    setShowResultOnly((current) => {
      if (!current) setShowResultant(true);
      return !current;
    });
    setAnimationRunning(false);
    if (animationForces) {
      setCompositionState('result');
      setAnimationProgress(1);
    }
  };

  const handleToggleResultant = () => {
    setShowResultant((current) => !current);
  };

  const handleToggleMagneticForce = () => {
    if (!activeForces) return;
    setShowMagneticForce((current) => !current);
  };

  const handleToggleMagneticForceAngle = () => {
    setShowMagneticAngle((current) => {
      const next = !current;
      if (next && activeForces) setShowMagneticForce(true);
      return next;
    });
  };

  const handleToggleCurrentMagneticForceAngle = () => {
    setShowCurrentAngle((current) => !current);
  };

  const handleToggleCurrentDirection = () => {
    setCurrentDirectionSign((current) => (current === 1 ? -1 : 1));
  };

  const captureKeySnapshot = async (source: 'manual' | 'auto') => {
    if (!activeForces || !directionMetrics || !canvasRef.current) return;
    const temporarilyShowLeftHandRule = includeLeftHandRuleInSnapshot && !showLeftHandRule;
    if (includeLeftHandRuleInSnapshot && !showLeftHandRule) {
      setShowLeftHandRule(true);
      await waitForNextFrame();
    }

    const imageDataUrl = canvasRef.current.toDataURL('image/png');
    if (temporarilyShowLeftHandRule) setShowLeftHandRule(false);
    snapshotCountersRef.current[source] += 1;
    const snapshot: KeySnapshot = {
      id: `${source}-${Date.now()}`,
      name: `${source === 'manual' ? '手动截图' : '自动截图'} ${snapshotCountersRef.current[source]}`,
      source,
      imageDataUrl,
      createdAt: Date.now(),
      forces: {
        f1: activeForces.f1,
        f2: activeForces.f2,
        f3: activeForces.f3,
        fSensorMagnitude: directionMetrics.fSensorMagnitude,
        fMagneticMagnitude: directionMetrics.fMagneticMagnitude,
      },
      directions: {
        currentDirection: directionMetrics.currentDirection,
        magneticFieldDirection: directionMetrics.magneticFieldDirection,
        magneticForceDirection: directionMetrics.magneticForceDirection,
      },
      angles: {
        angleBF: directionMetrics.angleBF,
        angleIF: directionMetrics.angleIF,
      },
      perpendicularPassed: directionMetrics.perpendicularPassed,
    };

    setKeySnapshots((current) => [...current, snapshot].slice(-MAX_KEY_SNAPSHOTS));
  };

  const handleManualSnapshot = () => {
    void captureKeySnapshot('manual');
  };

  const handleClearSnapshots = () => {
    setKeySnapshots([]);
    setSelectedSnapshot(null);
    setShowSixSnapshotGrid(false);
    snapshotCountersRef.current = { manual: 0, auto: 0 };
  };

  const handleScaleModeChange = (mode: ForceScaleMode) => {
    if (mode === 'locked') {
      setLockedForceScale(scaleFactor);
    } else if (mode === 'auto') {
      const targetScale = computeAutoForceScale(getForceMagnitudes(activeForces ?? latestForces));
      autoScaleInitializedRef.current = true;
      setAutoForceScale(targetScale);
    }
    setForceScaleMode(mode);
  };

  const handleManualScaleChange = (nextScale: number) => {
    setManualForceScale(clamp(nextScale, MIN_FORCE_SCALE, MAX_FORCE_SCALE));
  };

  const handleAutoAdjustScale = () => {
    autoScaleInitializedRef.current = true;
    setAutoForceScale(computeAutoForceScale(getForceMagnitudes(activeForces ?? latestForces)));
    setForceScaleMode('auto');
  };

  const handleLockScale = () => {
    setLockedForceScale(scaleFactor);
    setForceScaleMode('locked');
  };

  const handleResetScale = () => {
    autoScaleInitializedRef.current = true;
    setManualForceScale(DEFAULT_MANUAL_FORCE_SCALE);
    setLockedForceScale(null);
    setAutoForceScale(computeAutoForceScale(getForceMagnitudes(activeForces ?? latestForces)));
    setForceScaleMode('auto');
  };

  const handleVisualizationSplitPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panel = visualizationPanelRef.current;
    if (!panel) return;
    event.preventDefault();

    const updateRatio = (clientY: number) => {
      const rect = panel.getBoundingClientRect();
      if (rect.height <= 0) return;
      const nextRatio = clamp((clientY - rect.top) / rect.height, MIN_VISUALIZATION_SPLIT_RATIO, MAX_VISUALIZATION_SPLIT_RATIO);
      setVisualizationSplitRatio(nextRatio);
      window.localStorage.setItem(FORCE_VISUALIZATION_SPLIT_STORAGE_KEY, String(nextRatio));
    };

    updateRatio(event.clientY);
    document.body.classList.add('is-force-split-resizing');
    const handlePointerMove = (moveEvent: PointerEvent) => updateRatio(moveEvent.clientY);
    const handlePointerUp = () => {
      document.body.classList.remove('is-force-split-resizing');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  return (
    <section className="visualization-panel force-visualization-panel" ref={visualizationPanelRef}>
      <div className="force-scene-shell" style={{ flexBasis: `calc(${visualizationSplitRatio * 100}% - 4px)` }}>
        <ForceSceneCanvas
          forces={activeForces}
          scaleFactor={scaleFactor}
          showResultOnly={showResultOnly}
          showResultant={showResultant}
          showMagneticForce={showMagneticForce}
          compositionState={compositionState}
          animationProgress={animationProgress}
          minVisibleArrowLength={MIN_VISIBLE_ARROW_LENGTH}
          magneticDetection={latestMagneticFieldDetection}
          magneticFieldConfig={magneticFieldConfig}
          currentDirectionSign={currentDirectionSign}
          showIBPlane={showIBPlane}
          showLeftHandRule={showLeftHandRule}
          onCanvasReady={(canvas) => {
            canvasRef.current = canvas;
          }}
        />
        <div className="force-scene-overlay">
          <div>
            <h2>立体图示</h2>
            <p>
              导体棒沿 <PhysicsSymbol symbol="x" /> 轴；水平垂直方向为 <PhysicsSymbol symbol="y" />；竖直向上为{' '}
              <PhysicsSymbol symbol="z" />。<PhysicsSymbol symbol="F1" />、<PhysicsSymbol symbol="F2" />、
              <PhysicsSymbol symbol="F3" /> 长度按同一比例尺绘制。
            </p>
          </div>
          {activeForces && (
            <div className="force-readout">
              <span>
                <PhysicsSymbol symbol="F1" /> {activeForces.f1.toFixed(2)} N
              </span>
              <span>
                <PhysicsSymbol symbol="F2" /> {activeForces.f2.toFixed(2)} N
              </span>
              <span>
                <PhysicsSymbol symbol="F3" /> {activeForces.f3.toFixed(2)} N
              </span>
            </div>
          )}
        </div>
        {!activeForces && (
          <div className="force-waiting">
            <strong>等待 OCR 数据</strong>
            <span>
              请确认 <PhysicsSymbol symbol="F1" />、<PhysicsSymbol symbol="F2" />、<PhysicsSymbol symbol="F3" /> 已由 Tesseract
              实时识别。
            </span>
          </div>
        )}
      </div>
      <div
        className="force-vertical-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-label="调整 3D 图示与控制区高度"
        title="拖动调整 3D 图示与控制区高度"
        onPointerDown={handleVisualizationSplitPointerDown}
      />
      <div className="force-control-region" style={{ flexBasis: `calc(${(1 - visualizationSplitRatio) * 100}% - 4px)` }}>
        <ForceCompositionController
          forces={activeForces}
          waitingChannels={waitingChannels}
          isHoldingFrame={isHoldingFrame}
          showResultOnly={showResultOnly}
          showResultant={showResultant}
          showMagneticForce={showMagneticForce}
          showMagneticAngle={showMagneticAngle}
          magneticAngleText={magneticAngleText}
          showCurrentAngle={showCurrentAngle}
          currentAngleText={currentAngleText}
          currentDirectionSign={currentDirectionSign}
          showIBPlane={showIBPlane}
          showLeftHandRule={showLeftHandRule}
          includeLeftHandRuleInSnapshot={includeLeftHandRuleInSnapshot}
          autoSnapshotEnabled={autoSnapshotEnabled}
          keySnapshots={keySnapshots}
          directionMetrics={directionMetrics}
          perpendicularToleranceDeg={PERPENDICULAR_TOLERANCE_DEG}
          animationRunning={animationRunning}
          compositionState={compositionState}
          scaleFactor={scaleFactor}
          forceScaleMode={forceScaleMode}
          manualForceScale={manualForceScale}
          minForceScale={MIN_FORCE_SCALE}
          maxForceScale={MAX_FORCE_SCALE}
          minVisibleArrowLength={MIN_VISIBLE_ARROW_LENGTH}
          hasMinVisibleAmplification={hasMinVisibleAmplification}
          maxForce={maxForce}
          maxArrowLength={maxArrowLength}
          showFieldLines={magneticFieldConfig.showFieldLines}
          magneticStatusText={getMagneticStatusText(latestMagneticFieldDetection, magneticFieldConfig.showFieldLines)}
          onTogglePause={handleTogglePause}
          onCompose={handleCompose}
          onToggleResultOnly={handleToggleResultOnly}
          onToggleResultant={handleToggleResultant}
          onToggleMagneticForce={handleToggleMagneticForce}
          onToggleMagneticForceAngle={handleToggleMagneticForceAngle}
          onToggleCurrentMagneticForceAngle={handleToggleCurrentMagneticForceAngle}
          onToggleCurrentDirection={handleToggleCurrentDirection}
          onToggleIBPlane={() => setShowIBPlane((current) => !current)}
          onToggleLeftHandRule={() => setShowLeftHandRule((current) => !current)}
          onToggleIncludeLeftHandRule={() => setIncludeLeftHandRuleInSnapshot((current) => !current)}
          onToggleAutoSnapshot={() => setAutoSnapshotEnabled((current) => !current)}
          onManualSnapshot={handleManualSnapshot}
          onShowSixSnapshotGrid={() => setShowSixSnapshotGrid(true)}
          onSelectSnapshot={setSelectedSnapshot}
          onClearSnapshots={handleClearSnapshots}
          onToggleFieldLines={() => experimentDataActions.updateMagneticFieldConfig({ showFieldLines: !magneticFieldConfig.showFieldLines })}
          onScaleModeChange={handleScaleModeChange}
          onManualScaleChange={handleManualScaleChange}
          onAutoAdjustScale={handleAutoAdjustScale}
          onLockScale={handleLockScale}
          onResetScale={handleResetScale}
        />
      </div>
      {selectedSnapshot && <SnapshotModal snapshot={selectedSnapshot} onClose={() => setSelectedSnapshot(null)} />}
      {showSixSnapshotGrid && <SixSnapshotGrid snapshots={keySnapshots} onClose={() => setShowSixSnapshotGrid(false)} />}
    </section>
  );
}

function SnapshotModal({ snapshot, onClose }: { snapshot: KeySnapshot; onClose: () => void }) {
  return (
    <div className="snapshot-modal-backdrop" role="dialog" aria-modal="true" aria-label="关键图像记录详情">
      <div className="snapshot-modal">
        <div className="snapshot-modal-head">
          <div>
            <h3>{snapshot.name}</h3>
            <span>{formatSnapshotTime(snapshot.createdAt)}</span>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <img src={snapshot.imageDataUrl} alt={snapshot.name} />
        <SnapshotMetadata snapshot={snapshot} />
      </div>
    </div>
  );
}

function SixSnapshotGrid({ snapshots, onClose }: { snapshots: KeySnapshot[]; onClose: () => void }) {
  const visibleSnapshots = snapshots.slice(-MAX_KEY_SNAPSHOTS);
  return (
    <div className="snapshot-modal-backdrop" role="dialog" aria-modal="true" aria-label="六图展示">
      <div className="six-snapshot-grid-modal">
        <div className="snapshot-modal-head">
          <div>
            <h3>关键图像六图展示</h3>
            <span>最多显示最近 6 张关键图像</span>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="six-snapshot-grid">
          {visibleSnapshots.length === 0 && <p className="snapshot-empty">暂无关键图像记录。</p>}
          {visibleSnapshots.map((snapshot) => (
            <figure key={snapshot.id}>
              <img src={snapshot.imageDataUrl} alt={snapshot.name} />
              <figcaption>
                <strong>{snapshot.name}</strong>
                <span>{formatSnapshotTime(snapshot.createdAt)}</span>
                <span>
                  B-F：{formatAngleValue(snapshot.angles.angleBF)} / I-F：{formatAngleValue(snapshot.angles.angleIF)}
                </span>
                <span>{snapshot.perpendicularPassed ? '垂直性判断：通过' : '垂直性判断：未满足'}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

function SnapshotMetadata({ snapshot }: { snapshot: KeySnapshot }) {
  return (
    <dl className="snapshot-metadata">
      <div>
        <dt>来源</dt>
        <dd>{snapshot.source === 'manual' ? '手动截图' : '自动截图'}</dd>
      </div>
      <div>
        <dt>垂直性判断</dt>
        <dd>{snapshot.perpendicularPassed ? '通过' : '未满足'}</dd>
      </div>
      <div>
        <dt>F磁场力</dt>
        <dd>{snapshot.forces.fMagneticMagnitude.toFixed(2)} N</dd>
      </div>
      <div>
        <dt>∠(B, F磁场力)</dt>
        <dd>{formatAngleValue(snapshot.angles.angleBF)}</dd>
      </div>
      <div>
        <dt>∠(I, F磁场力)</dt>
        <dd>{formatAngleValue(snapshot.angles.angleIF)}</dd>
      </div>
      <div>
        <dt>F1 / F2 / F3</dt>
        <dd>
          {snapshot.forces.f1.toFixed(2)} / {snapshot.forces.f2.toFixed(2)} / {snapshot.forces.f3.toFixed(2)} N
        </dd>
      </div>
    </dl>
  );
}

interface ForceSceneCanvasProps {
  forces: ForceTriplet | null;
  scaleFactor: number;
  showResultOnly: boolean;
  showResultant: boolean;
  showMagneticForce: boolean;
  compositionState: CompositionState;
  animationProgress: number;
  minVisibleArrowLength: number;
  magneticDetection?: MagneticFieldDetectionResult;
  magneticFieldConfig: MagneticFieldConfig;
  currentDirectionSign: 1 | -1;
  showIBPlane: boolean;
  showLeftHandRule: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

function ForceSceneCanvas({
  forces,
  scaleFactor,
  showResultOnly,
  showResultant,
  showMagneticForce,
  compositionState,
  animationProgress,
  minVisibleArrowLength,
  magneticDetection,
  magneticFieldConfig,
  currentDirectionSign,
  showIBPlane,
  showLeftHandRule,
  onCanvasReady,
}: ForceSceneCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const dynamicGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111a23');
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(-7, 3.5, 2.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    onCanvasReady?.(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.2, 0);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.85;
    controls.panSpeed = 0.65;
    controls.minDistance = 2.6;
    controls.maxDistance = 9.8;
    controls.update();

    const staticGroup = createStaticScene();
    const dynamicGroup = new THREE.Group();
    scene.add(staticGroup);
    scene.add(dynamicGroup);

    scene.add(new THREE.AmbientLight(0xffffff, 0.82));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    dynamicGroupRef.current = dynamicGroup;
    controlsRef.current = controls;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let renderFrame = 0;
    const renderLoop = () => {
      controls.update();
      renderer.render(scene, camera);
      renderFrame = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(renderFrame);
      observer.disconnect();
      controls.dispose();
      disposeObject3D(scene);
      renderer.dispose();
      renderer.domElement.remove();
      onCanvasReady?.(null);
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      dynamicGroupRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const dynamicGroup = dynamicGroupRef.current;
    if (!dynamicGroup) return;

    disposeObject3D(dynamicGroup);
    dynamicGroup.clear();

    if (magneticFieldConfig.showFieldLines) {
      dynamicGroup.add(createMagneticFieldLinesGroup(magneticDetection, magneticFieldConfig));
    }

    dynamicGroup.add(createCurrentArrowGroup(currentDirectionSign));

    const magneticFieldDirection = magneticDetection?.fieldDirection2D || (magneticDetection?.nPole && magneticDetection.sPole)
      ? getMagneticFieldDirection3D(magneticDetection)
      : null;
    const currentDirection = new THREE.Vector3(currentDirectionSign, 0, 0);

    if (showIBPlane && magneticFieldDirection) {
      dynamicGroup.add(createIBPlaneGroup(currentDirection, magneticFieldDirection));
    }

    if (forces) {
      const forceGroup = createForceSceneGroup(
        forces,
        scaleFactor,
        minVisibleArrowLength,
        showResultOnly,
        showResultant,
        showMagneticForce,
        compositionState,
        animationProgress,
      );
      dynamicGroup.add(forceGroup);

      const magneticForceDirection = createSceneForceVectors(forces, 1).resultant.clone().multiplyScalar(-1);
      if (showLeftHandRule && magneticFieldDirection && magneticForceDirection.length() > 0.0001) {
        dynamicGroup.add(createLeftHandRuleGroup(currentDirection, magneticFieldDirection, magneticForceDirection.normalize()));
      }
    }
  }, [
    animationProgress,
    compositionState,
    currentDirectionSign,
    forces,
    magneticDetection,
    magneticFieldConfig,
    minVisibleArrowLength,
    scaleFactor,
    showIBPlane,
    showLeftHandRule,
    showMagneticForce,
    showResultant,
    showResultOnly,
  ]);

  return <div ref={mountRef} className="force-three-canvas" aria-label="立体图示与合成演示模块" />;
}

function createStaticScene() {
  const group = new THREE.Group();

  const grid = new THREE.GridHelper(5.8, 14, '#46515f', '#26313c');
  setObjectOpacity(grid, 0.42);
  grid.position.y = -0.01;
  group.add(grid);

  group.add(createAxis('X', new THREE.Vector3(2.85, 0, 0), AXIS_COLOR, new THREE.Vector3(0.16, 0.08, 0)));
  group.add(createAxis('Z', new THREE.Vector3(0, 2.45, 0), AXIS_COLOR, new THREE.Vector3(0.12, 0.08, 0)));
  group.add(createAxis('Y', new THREE.Vector3(0, 0, 2.45), AXIS_COLOR, new THREE.Vector3(0.14, 0.1, 0.12)));

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 4.7, 24),
    new THREE.MeshStandardMaterial({ color: '#b8c2cc', metalness: 0.1, roughness: 0.48 }),
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 0, 0);
  group.add(rod);

  const actionPoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 28, 28),
    new THREE.MeshStandardMaterial({ color: '#f8fbff', emissive: '#0c2733', emissiveIntensity: 0.25 }),
  );
  group.add(actionPoint);

  return group;
}

function createAxis(label: string, vector: THREE.Vector3, color: string, labelOffset: THREE.Vector3) {
  const group = new THREE.Group();
  const arrow = new THREE.ArrowHelper(vector.clone().normalize(), new THREE.Vector3(0, 0, 0), vector.length(), color, 0.18, 0.1);
  setObjectOpacity(arrow, 0.62);
  group.add(arrow);
  const sprite = createTextSprite(label, '#cbd5e1');
  sprite.scale.set(0.36, 0.16, 1);
  sprite.position.copy(vector.clone().add(labelOffset));
  group.add(sprite);
  return group;
}

function setObjectOpacity(object: THREE.Object3D, opacity: number) {
  object.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.Line;
    if (!('material' in renderable) || !renderable.material) return;
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = opacity;
    });
  });
}

function createForceSceneGroup(
  forces: ForceTriplet,
  scaleFactor: number,
  minVisibleArrowLength: number,
  showResultOnly: boolean,
  showResultant: boolean,
  showMagneticForce: boolean,
  compositionState: CompositionState,
  animationProgress: number,
) {
  const group = new THREE.Group();
  const origin = new THREE.Vector3(0, 0, 0);
  const { v1, v2, v3, v12, resultant: vF } = createSceneForceVectors(forces, scaleFactor);
  const visibleV1 = applyMinimumVisibleLength(v1, minVisibleArrowLength);
  const visibleV2 = applyMinimumVisibleLength(v2, minVisibleArrowLength);
  const visibleV3 = applyMinimumVisibleLength(v3, minVisibleArrowLength);
  const visibleV12 = applyMinimumVisibleLength(v12, minVisibleArrowLength);
  const visibleVF = applyMinimumVisibleLength(vF, minVisibleArrowLength);
  const progress12 = getProgress12(compositionState, animationProgress);
  const progressF = getProgressF(compositionState, animationProgress);
  const f12Magnitude = Math.sqrt(forces.f1 ** 2 + forces.f2 ** 2);
  const fMagnitude = Math.sqrt(forces.f1 ** 2 + forces.f2 ** 2 + forces.f3 ** 2);

  if (showResultOnly) {
    if (showResultant) {
      group.add(createForceArrowGroup({ label: 'F', valueN: fMagnitude, vector: visibleVF, color: RESULT_COLOR, origin, labelOffset: new THREE.Vector3(0.14, 0.2, 0.14) }));
    }
    if (showMagneticForce) {
      group.add(createMagneticForceArrow(origin, visibleVF, fMagnitude));
    }
    return group;
  }

  group.add(createForceArrowGroup({ label: toUnicodePhysicsSymbol('F1'), valueN: forces.f1, vector: visibleV1, color: COMPONENT_COLOR, origin, labelOffset: new THREE.Vector3(0.08, 0.18, 0) }));
  group.add(createForceArrowGroup({ label: toUnicodePhysicsSymbol('F2'), valueN: forces.f2, vector: visibleV2, color: COMPONENT_COLOR, origin, labelOffset: new THREE.Vector3(0.2, 0.08, 0) }));
  group.add(createForceArrowGroup({ label: toUnicodePhysicsSymbol('F3'), valueN: forces.f3, vector: visibleV3, color: COMPONENT_COLOR, origin, labelOffset: new THREE.Vector3(0.16, 0.18, 0.08) }));

  if (compositionState !== 'idle') {
    group.add(createDashedLine(v1, v12, HELPER_COLOR, 0.45));
    group.add(createDashedLine(v2, v12, HELPER_COLOR, 0.45));
    group.add(
      createForceArrowGroup({
        label: toUnicodePhysicsSymbol('F12'),
        valueN: f12Magnitude,
        vector: visibleV12.clone().multiplyScalar(progress12),
        color: F12_COLOR,
        origin,
        opacity: progress12 < 1 ? 0.9 : 1,
        labelOffset: new THREE.Vector3(0.12, 0.18, 0),
      }),
    );
  }

  if (compositionState === 'compose123' || compositionState === 'result') {
    group.add(createDashedLine(v12, vF, HELPER_COLOR, 0.42));
    group.add(createDashedLine(v3, vF, HELPER_COLOR, 0.42));
    if (showResultant) group.add(
      createForceArrowGroup({
        label: 'F',
        valueN: fMagnitude,
        vector: visibleVF.clone().multiplyScalar(progressF),
        color: RESULT_COLOR,
        origin,
        opacity: progressF < 1 ? 0.9 : 1,
        labelOffset: new THREE.Vector3(0.14, 0.24, 0.14),
      }),
    );
  }

  if (showMagneticForce) {
    if (showResultant && (compositionState === 'idle' || compositionState === 'compose12')) {
      group.add(createForceArrowGroup({ label: 'F', valueN: fMagnitude, vector: visibleVF, color: RESULT_COLOR, origin, labelOffset: new THREE.Vector3(0.14, 0.24, 0.14) }));
    }
    group.add(createMagneticForceArrow(origin, visibleVF, fMagnitude));
  }

  return group;
}

function createSceneForceVectors(forces: ForceTriplet, scaleFactor: number) {
  // 课堂坐标：导体棒沿 x；水平垂直于导体棒为 y；竖直向上为 z。
  // Three.js 的 scene Y 是竖直方向，scene Z 是水平横向，因此这里只做渲染层映射。
  const v1 = new THREE.Vector3(forces.f1 * scaleFactor, 0, 0);
  const v2 = new THREE.Vector3(0, 0, forces.f2 * scaleFactor);
  const v3 = new THREE.Vector3(0, forces.f3 * scaleFactor, 0);
  const v12 = v1.clone().add(v2);
  return {
    v1,
    v2,
    v3,
    v12,
    resultant: v12.clone().add(v3),
  };
}

function createMagneticForceArrow(origin: THREE.Vector3, visibleResultant: THREE.Vector3, magnitudeN: number) {
  return createForceArrowGroup({
    label: 'F磁场力',
    valueN: magnitudeN,
    vector: visibleResultant.clone().multiplyScalar(-1),
    color: MAGNETIC_FORCE_COLOR,
    origin,
    labelOffset: new THREE.Vector3(-0.18, 0.2, -0.14),
  });
}

function createCurrentArrowGroup(currentDirectionSign: 1 | -1) {
  const group = new THREE.Group();
  const origin = new THREE.Vector3(currentDirectionSign === 1 ? -0.82 : 0.82, 0.16, 0);
  const vector = new THREE.Vector3(currentDirectionSign * 1.25, 0, 0);
  const arrow = new THREE.ArrowHelper(vector.clone().normalize(), origin, vector.length(), CURRENT_COLOR, 0.2, 0.12);
  group.add(arrow);

  const label = createTextSprite('I', CURRENT_COLOR);
  label.scale.set(1.18, 0.34, 1);
  label.position.copy(origin.clone().add(vector).add(new THREE.Vector3(0, 0.34, 0.14)));
  group.add(label);
  return group;
}

function createIBPlaneGroup(currentDirection: THREE.Vector3, magneticFieldDirection: THREE.Vector3) {
  const group = new THREE.Group();
  const iDirection = currentDirection.clone().normalize();
  const bDirection = magneticFieldDirection.clone().normalize();
  const normal = iDirection.clone().cross(bDirection);
  if (normal.length() < 0.02) return group;

  const iHalf = iDirection.clone().multiplyScalar(2.25);
  const bHalf = bDirection.clone().multiplyScalar(1.75);
  const corners = [
    iHalf.clone().multiplyScalar(-1).add(bHalf.clone().multiplyScalar(-1)),
    iHalf.clone().add(bHalf.clone().multiplyScalar(-1)),
    iHalf.clone().add(bHalf),
    iHalf.clone().multiplyScalar(-1).add(bHalf),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints([corners[0], corners[1], corners[2], corners[0], corners[2], corners[3]]);
  const material = new THREE.MeshBasicMaterial({
    color: IB_PLANE_COLOR,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.renderOrder = 4;
  group.add(plane);

  const outlineGeometry = new THREE.BufferGeometry().setFromPoints([...corners, corners[0]]);
  const outline = new THREE.Line(
    outlineGeometry,
    new THREE.LineBasicMaterial({ color: IB_PLANE_COLOR, transparent: true, opacity: 0.62 }),
  );
  group.add(outline);

  const label = createTextSprite('I-B 平面', '#dbeafe');
  label.scale.set(0.72, 0.2, 1);
  label.position.copy(bDirection.clone().multiplyScalar(1.95).add(iDirection.clone().multiplyScalar(1.55)).add(new THREE.Vector3(0, 0.18, 0)));
  group.add(label);
  return group;
}

function createLeftHandRuleGroup(
  currentDirection: THREE.Vector3,
  magneticFieldDirection: THREE.Vector3,
  magneticForceDirection: THREE.Vector3,
) {
  const group = new THREE.Group();
  const iDirection = currentDirection.clone().normalize();
  const bDirection = magneticFieldDirection.clone().normalize();
  const fDirection = magneticForceDirection.clone().normalize();
  const base = new THREE.Vector3(-1.18, 0.54, -1.0);
  const palmNormal = bDirection.length() > 0.0001 ? bDirection : new THREE.Vector3(0, 1, 0);

  const palm = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 40),
    new THREE.MeshBasicMaterial({
      color: LEFT_HAND_COLOR,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  palm.position.copy(base);
  palm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), palmNormal);
  group.add(palm);

  const wrist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.42, 18),
    new THREE.MeshBasicMaterial({ color: LEFT_HAND_COLOR, transparent: true, opacity: 0.34 }),
  );
  wrist.position.copy(base.clone().add(fDirection.clone().multiplyScalar(-0.34)));
  wrist.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fDirection);
  group.add(wrist);

  const fingerOffset = fDirection.clone().multiplyScalar(0.08);
  const lateral = new THREE.Vector3().crossVectors(iDirection, palmNormal);
  if (lateral.length() < 0.001) lateral.set(0, 0, 1);
  lateral.normalize();
  [-0.18, -0.06, 0.06, 0.18].forEach((offset) => {
    const origin = base
      .clone()
      .add(iDirection.clone().multiplyScalar(-0.45))
      .add(lateral.clone().multiplyScalar(offset))
      .add(fingerOffset);
    group.add(new THREE.ArrowHelper(iDirection, origin, 0.88, CURRENT_COLOR, 0.13, 0.07));
  });

  group.add(new THREE.ArrowHelper(fDirection, base.clone().add(fDirection.clone().multiplyScalar(0.06)), 0.82, MAGNETIC_FORCE_COLOR, 0.15, 0.08));
  group.add(new THREE.ArrowHelper(bDirection, base.clone().add(bDirection.clone().multiplyScalar(-0.45)), 0.9, '#7ddff4', 0.12, 0.07));

  const iLabel = createTextSprite('I 四指方向', CURRENT_COLOR);
  iLabel.scale.set(0.72, 0.2, 1);
  iLabel.position.copy(base.clone().add(iDirection.clone().multiplyScalar(0.72)).add(lateral.clone().multiplyScalar(0.26)));
  group.add(iLabel);

  const fLabel = createTextSprite('F 大拇指方向', MAGNETIC_FORCE_COLOR);
  fLabel.scale.set(0.76, 0.2, 1);
  fLabel.position.copy(base.clone().add(fDirection.clone().multiplyScalar(0.98)));
  group.add(fLabel);

  const bLabel = createTextSprite('B 入掌心', '#7ddff4');
  bLabel.scale.set(0.66, 0.2, 1);
  bLabel.position.copy(base.clone().add(bDirection.clone().multiplyScalar(-0.62)).add(new THREE.Vector3(0, 0.16, 0)));
  group.add(bLabel);

  return group;
}

export function computeAngleBetweenVectors(a: [number, number, number], b: [number, number, number]) {
  const vectorA = new THREE.Vector3(...a);
  const vectorB = new THREE.Vector3(...b);
  if (vectorA.length() < 0.0001 || vectorB.length() < 0.0001) return null;
  const dot = clamp(vectorA.normalize().dot(vectorB.normalize()), -1, 1);
  return (Math.acos(dot) * 180) / Math.PI;
}

function getDirectionMetrics(
  forces: ForceTriplet | null | undefined,
  detection: MagneticFieldDetectionResult | undefined,
  currentDirectionSign: 1 | -1,
  toleranceDeg: number,
): DirectionMetrics | null {
  if (!forces) return null;

  const resultant = createSceneForceVectors(forces, 1).resultant;
  const fSensorMagnitude = resultant.length();
  const magneticForce = resultant.clone().multiplyScalar(-1);
  const fMagneticMagnitude = magneticForce.length();
  const currentDirection: [number, number, number] = [currentDirectionSign, 0, 0];
  const magneticForceDirection =
    fMagneticMagnitude > 0.0001 ? (magneticForce.clone().normalize().toArray() as [number, number, number]) : undefined;
  const magneticFieldVector = detection?.fieldDirection2D || (detection?.nPole && detection.sPole)
    ? getMagneticFieldDirection3D(detection)
    : null;
  const magneticFieldDirection =
    magneticFieldVector && magneticFieldVector.length() > 0.0001
      ? (magneticFieldVector.clone().normalize().toArray() as [number, number, number])
      : undefined;

  const angleIF = magneticForceDirection ? computeAngleBetweenVectors(currentDirection, magneticForceDirection) ?? undefined : undefined;
  const angleBF =
    magneticFieldDirection && magneticForceDirection
      ? computeAngleBetweenVectors(magneticFieldDirection, magneticForceDirection) ?? undefined
      : undefined;
  const perpendicularPassed =
    typeof angleIF === 'number' &&
    typeof angleBF === 'number' &&
    Math.abs(angleIF - 90) <= toleranceDeg &&
    Math.abs(angleBF - 90) <= toleranceDeg;
  const perpendicularMessage = !magneticForceDirection
    ? '垂直性判断：缺少有效 F磁场力'
    : !magneticFieldDirection
      ? '垂直性判断：等待摄像头磁场方向'
      : perpendicularPassed
        ? '垂直性判断：通过，F磁场力近似垂直于 I-B 平面'
        : `垂直性判断：未满足，需同时接近 90°±${toleranceDeg}°`;

  return {
    fSensorMagnitude,
    fMagneticMagnitude,
    currentDirection,
    magneticFieldDirection,
    magneticForceDirection,
    angleBF,
    angleIF,
    perpendicularPassed,
    perpendicularMessage,
  };
}

function getMagneticForceAngleText(forces: ForceTriplet | null | undefined, detection?: MagneticFieldDetectionResult) {
  if (!forces) return '∠(B, F磁场力) = --';
  const resultant = createSceneForceVectors(forces, 1).resultant;
  const magneticForce = resultant.clone().multiplyScalar(-1);
  const magneticField = getMagneticFieldDirection3D(detection);
  const angle = computeAngleBetweenVectors(magneticField.toArray(), magneticForce.toArray());
  return angle === null ? '∠(B, F磁场力) = --' : `∠(B, F磁场力) = ${angle.toFixed(1)}°`;
}

function getCurrentMagneticForceAngleText(forces: ForceTriplet | null | undefined, currentDirectionSign: 1 | -1) {
  if (!forces) return '无法计算 ∠(I, F磁场力)：缺少有效 F磁场力';
  const resultant = createSceneForceVectors(forces, 1).resultant;
  const magneticForce = resultant.clone().multiplyScalar(-1);
  const angle = computeAngleBetweenVectors([currentDirectionSign, 0, 0], magneticForce.toArray());
  return angle === null
    ? '无法计算 ∠(I, F磁场力)：缺少有效 F磁场力'
    : `∠(I, F磁场力) = ${angle.toFixed(1)}°`;
}

function readTesseractForces(latestValues: Record<string, PhysicsSample>): ForceTriplet | null {
  const f1 = findTesseractSample(latestValues, 'F1');
  const f2 = findTesseractSample(latestValues, 'F2');
  const f3 = findTesseractSample(latestValues, 'F3');
  if (!f1 || !f2 || !f3) return null;
  return {
    f1: f1.value,
    f2: f2.value,
    f3: f3.value,
    timestamp: Math.max(f1.timestamp, f2.timestamp, f3.timestamp),
  };
}

function getMagneticStatusText(
  detection: MagneticFieldDetectionResult | undefined,
  showFieldLines: boolean,
) {
  if (!showFieldLines) return '隐藏';
  if (detection?.nPole && detection.sPole) return 'N → S 已识别';
  return '默认方向';
}

function getWaitingChannels(latestValues: Record<string, PhysicsSample>) {
  return ['F1', 'F2', 'F3'].filter((channelId) => !findTesseractSample(latestValues, channelId));
}

function findTesseractSample(latestValues: Record<string, PhysicsSample>, channelId: string) {
  const direct = latestValues[channelId];
  if (direct?.method === 'tesseract') return direct;
  return Object.values(latestValues).find(
    (sample) =>
      sample.method === 'tesseract' && (sample.channelId === channelId || sample.symbol === channelId || sample.name === channelId),
  );
}

export function computeAutoForceScale(
  forces: number[],
  options: {
    minScale?: number;
    maxScale?: number;
    targetMaxArrowLength?: number;
    lowForceFallbackScale?: number;
  } = {},
) {
  const minScale = options.minScale ?? MIN_FORCE_SCALE;
  const maxScale = options.maxScale ?? MAX_FORCE_SCALE;
  const targetMaxArrowLength = options.targetMaxArrowLength ?? TARGET_MAX_ARROW_LENGTH;
  const lowForceFallbackScale = options.lowForceFallbackScale ?? 20;
  const maxForce = Math.max(...forces.map((force) => Math.abs(force)), 0);
  if (maxForce < 0.05) return clamp(lowForceFallbackScale, minScale, maxScale);
  return clamp(targetMaxArrowLength / maxForce, minScale, maxScale);
}

function getForceMagnitudes(forces: ForceTriplet | null) {
  if (!forces) return [];
  return [
    forces.f1,
    forces.f2,
    forces.f3,
    Math.sqrt(forces.f1 ** 2 + forces.f2 ** 2),
    Math.sqrt(forces.f1 ** 2 + forces.f2 ** 2 + forces.f3 ** 2),
  ];
}

function getMaxForceMagnitude(forces: ForceTriplet | null) {
  return Math.max(...getForceMagnitudes(forces).map((force) => Math.abs(force)), 0);
}

function applyMinimumVisibleLength(vector: THREE.Vector3, minVisibleArrowLength: number) {
  const length = vector.length();
  if (length < 0.0001 || length >= minVisibleArrowLength) return vector;
  return vector.clone().setLength(minVisibleArrowLength);
}

function shouldApplyMinimumVisibleLength(forces: ForceTriplet | null, scaleFactor: number, minVisibleArrowLength: number) {
  return getForceMagnitudes(forces).some((force) => {
    const displayLength = Math.abs(force) * scaleFactor;
    return Math.abs(force) > 0.0001 && displayLength < minVisibleArrowLength;
  });
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function formatSnapshotTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString();
}

function formatAngleValue(angle: number | undefined) {
  return typeof angle === 'number' ? `${angle.toFixed(1)}°` : '--';
}

function readStoredVisualizationSplitRatio() {
  const rawValue = window.localStorage.getItem(FORCE_VISUALIZATION_SPLIT_STORAGE_KEY);
  const parsed = rawValue ? Number(rawValue) : DEFAULT_VISUALIZATION_SPLIT_RATIO;
  if (!Number.isFinite(parsed)) return DEFAULT_VISUALIZATION_SPLIT_RATIO;
  return clamp(parsed, MIN_VISUALIZATION_SPLIT_RATIO, MAX_VISUALIZATION_SPLIT_RATIO);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getProgress12(state: CompositionState, progress: number) {
  if (state === 'idle') return 0;
  if (state === 'compose12') return easeOutCubic(Math.min(1, progress / 0.47));
  return 1;
}

function getProgressF(state: CompositionState, progress: number) {
  if (state === 'compose123') return easeOutCubic(Math.min(1, Math.max(0, (progress - 0.47) / 0.47)));
  if (state === 'result') return 1;
  return 0;
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}
