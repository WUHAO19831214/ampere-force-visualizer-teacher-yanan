import { useEffect, useMemo, useRef, useState } from 'react';
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

const COMPONENT_COLOR = '#36d4cb';
const F12_COLOR = '#f6a72f';
const RESULT_COLOR = '#ff5c45';
const MAGNETIC_FORCE_COLOR = '#a78bfa';
const CURRENT_COLOR = '#facc15';
const HELPER_COLOR = '#d9e2ec';
const AXIS_COLOR = '#aeb8c4';
const DEFAULT_MANUAL_FORCE_SCALE = 5;
const MIN_FORCE_SCALE = 0.2;
const MAX_FORCE_SCALE = 30;
const TARGET_MAX_ARROW_LENGTH = 3;
const MIN_VISIBLE_ARROW_LENGTH = 0.25;
const AUTO_SCALE_SMOOTHING_WEIGHT = 0.2;

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
  const [animationRunning, setAnimationRunning] = useState(false);
  const [compositionState, setCompositionState] = useState<CompositionState>('idle');
  const [animationProgress, setAnimationProgress] = useState(0);
  const [forceScaleMode, setForceScaleMode] = useState<ForceScaleMode>('auto');
  const [manualForceScale, setManualForceScale] = useState(DEFAULT_MANUAL_FORCE_SCALE);
  const [autoForceScale, setAutoForceScale] = useState(DEFAULT_MANUAL_FORCE_SCALE);
  const [lockedForceScale, setLockedForceScale] = useState<number | null>(null);
  const [heldForceScale, setHeldForceScale] = useState<number | null>(null);
  const [animationForceScale, setAnimationForceScale] = useState<number | null>(null);
  const autoScaleInitializedRef = useRef(false);

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

  return (
    <section className="visualization-panel force-visualization-panel">
      <div className="force-scene-shell">
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
        onToggleFieldLines={() => experimentDataActions.updateMagneticFieldConfig({ showFieldLines: !magneticFieldConfig.showFieldLines })}
        onScaleModeChange={handleScaleModeChange}
        onManualScaleChange={handleManualScaleChange}
        onAutoAdjustScale={handleAutoAdjustScale}
        onLockScale={handleLockScale}
        onResetScale={handleResetScale}
      />
    </section>
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

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
    }
  }, [animationProgress, compositionState, currentDirectionSign, forces, magneticDetection, magneticFieldConfig, minVisibleArrowLength, scaleFactor, showMagneticForce, showResultant, showResultOnly]);

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

export function computeAngleBetweenVectors(a: [number, number, number], b: [number, number, number]) {
  const vectorA = new THREE.Vector3(...a);
  const vectorB = new THREE.Vector3(...b);
  if (vectorA.length() < 0.0001 || vectorB.length() < 0.0001) return null;
  const dot = clamp(vectorA.normalize().dot(vectorB.normalize()), -1, 1);
  return (Math.acos(dot) * 180) / Math.PI;
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
