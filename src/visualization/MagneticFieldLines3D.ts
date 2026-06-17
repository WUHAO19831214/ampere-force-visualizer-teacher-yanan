import * as THREE from 'three';
import type { MagneticFieldConfig, MagneticFieldDetectionResult } from '../types/vision';
import type { VisualizationTheme } from './ForceVisualization3D';
import { createTextSprite } from './ForceArrow3D';

const WIRE_COLOR = '#d6dee8';
const FIELD_LINE_SPACING_MULTIPLIER = 3;
const FIELD_LINE_LENGTH_MULTIPLIER = 0.7;
const DEFAULT_FIELD_ROWS = 4;
const DEFAULT_FIELD_COLS = 4;
const DEFAULT_FIELD_X_SPACING = 0.76;
const DEFAULT_FIELD_SIDE_SPACING = 0.76;
// 与 ForceVisualization3D 的课堂图示约定一致：+x 在渲染层指向 scene -X。
const SCENE_X_POSITIVE_SIGN = -1;

const FIELD_THEME_COLORS = {
  dark: {
    line: '#7decff',
    head: '#a0f5ff',
    label: '#d8fbff',
    shaftOpacity: 0.34,
    arrowOpacity: 0.68,
  },
  light: {
    line: '#0096b4',
    head: '#0082a0',
    label: '#075985',
    shaftOpacity: 0.32,
    arrowOpacity: 0.64,
  },
};

export function createMagneticFieldLinesGroup(
  detection: MagneticFieldDetectionResult | undefined,
  config: MagneticFieldConfig,
  theme: VisualizationTheme = 'dark',
  options: { simplified?: boolean; singleArrowOnly?: boolean } = {},
) {
  const group = new THREE.Group();
  const colors = FIELD_THEME_COLORS[theme];
  const wirePosition = new THREE.Vector3(...config.wirePosition3D);
  const direction = getMagneticFieldDirection3D(detection);
  const sideDirection = new THREE.Vector3(0, -direction.z, direction.y);
  if (sideDirection.length() < 0.001) sideDirection.set(0, 0, 1);
  sideDirection.normalize();
  const xDirection = new THREE.Vector3(SCENE_X_POSITIVE_SIGN, 0, 0);
  const rows = options.simplified ? 1 : Math.max(1, Math.min(8, config.fieldLineRows ?? DEFAULT_FIELD_ROWS));
  const cols = Math.max(1, Math.min(8, config.fieldLineCols ?? DEFAULT_FIELD_COLS));
  const length = Math.max(1.0, config.fieldLineLength * FIELD_LINE_LENGTH_MULTIPLIER);
  const legacySpacing = Math.max(0.12, config.fieldLineSpacing * FIELD_LINE_SPACING_MULTIPLIER);
  const xSpacing = Math.max(0.24, config.fieldLineXSpacing ?? Math.max(DEFAULT_FIELD_X_SPACING, legacySpacing * 0.75));
  const sideSpacing = Math.max(0.24, config.fieldLineSideSpacing ?? Math.max(DEFAULT_FIELD_SIDE_SPACING, legacySpacing * 0.75));
  const shaftOpacity = clamp(config.fieldLineOpacity ?? colors.shaftOpacity, 0.18, 0.58);
  const arrowOpacity = clamp(shaftOpacity + 0.18, 0.42, colors.arrowOpacity);

  addWireMarker(group, wirePosition);

  if (options.singleArrowOnly) {
    const singleLength = Math.max(1.8, Math.min(length * 2.35, 3.25));
    const start = wirePosition.clone().add(direction.clone().multiplyScalar(-singleLength / 2));
    const shaftLength = singleLength * 0.82;
    const shaftRadius = 0.056;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 18),
      new THREE.MeshBasicMaterial({ color: colors.line, transparent: true, opacity: clamp(colors.arrowOpacity, 0.6, 0.82), depthWrite: false }),
    );
    shaft.position.copy(start.clone().add(direction.clone().multiplyScalar(shaftLength / 2)));
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    group.add(shaft);

    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.55, 28),
      new THREE.MeshBasicMaterial({ color: colors.head, transparent: true, opacity: clamp(colors.arrowOpacity + 0.08, 0.7, 0.9), depthWrite: false }),
    );
    head.position.copy(start.clone().add(direction.clone().multiplyScalar(singleLength - 0.28)));
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    group.add(head);

    const label = createTextSprite('B', colors.label);
    label.scale.set(5.2, 1.42, 1);
    const arrowTip = start.clone().add(direction.clone().multiplyScalar(singleLength));
    const labelForwardOffset = Math.max(0.16, singleLength * 0.12);
    const labelSideOffset = Math.max(0.14, sideSpacing * 0.36);
    const labelXOffset = Math.max(0.08, xSpacing * 0.18);
    label.position.copy(
      arrowTip
        .clone()
        .add(direction.clone().multiplyScalar(labelForwardOffset))
        .add(sideDirection.clone().multiplyScalar(labelSideOffset))
        .add(xDirection.clone().multiplyScalar(labelXOffset)),
    );
    group.add(label);
    return group;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const xOffset = (col - (cols - 1) / 2) * xSpacing;
      const sideOffset = (row - (rows - 1) / 2) * sideSpacing;
      const center = wirePosition
        .clone()
        .add(xDirection.clone().multiplyScalar(xOffset))
        .add(sideDirection.clone().multiplyScalar(sideOffset));
      const start = center.clone().add(direction.clone().multiplyScalar(-length / 2));
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, length * 0.82, 12),
        new THREE.MeshBasicMaterial({ color: colors.line, transparent: true, opacity: shaftOpacity }),
      );
      shaft.position.copy(start.clone().add(direction.clone().multiplyScalar((length * 0.82) / 2)));
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      group.add(shaft);
      const arrow = new THREE.ArrowHelper(direction, start, length, colors.head, 0.28, 0.15);
      setOpacity(arrow, arrowOpacity);
      group.add(arrow);
    }
  }

  const label = createTextSprite('B', colors.label);
  label.scale.set(2.1, 0.58, 1);
  label.position.copy(
    wirePosition
      .clone()
      .add(direction.clone().multiplyScalar(length * 0.45))
      .add(sideDirection.clone().multiplyScalar(sideSpacing * 2.2))
      .add(xDirection.clone().multiplyScalar(xSpacing * 1.8)),
  );
  group.add(label);

  return group;
}

export function getMagneticFieldDirection3D(detection?: MagneticFieldDetectionResult) {
  if (detection?.nPole && detection.sPole) {
    return new THREE.Vector3(...mapCameraFieldDirectionTo3D(detection.nPole, detection.sPole));
  }

  if (detection?.fieldDirection2D) {
    const { x, y } = detection.fieldDirection2D;
    return normalizeMagneticDirection3D(0, -y, x);
  }

  return new THREE.Vector3(0, 1, 0);
}

export function mapCameraFieldDirectionTo3D(
  nPole: { x: number; y: number },
  sPole: { x: number; y: number },
): [number, number, number] {
  const dx = sPole.x - nPole.x;
  const dy = sPole.y - nPole.y;

  // Three.js 渲染层中，摄像头画面平面仍对应 scene YZ 平面。
  // 课堂标签约定为：scene Y（竖直向上）标作 z，scene Z（水平横向）标作 y。
  // 导体棒沿 x 轴，N→S 磁场方向仍映射为 [0, -dy, dx]，不改变既有磁感线旋转逻辑。
  return normalizeMagneticDirection3D(0, -dy, dx).toArray() as [number, number, number];
}

function normalizeMagneticDirection3D(x: number, y: number, z: number) {
  const mapped = new THREE.Vector3(x, y, z);
  if (mapped.length() < 0.001) return new THREE.Vector3(0, 1, 0);
  return mapped.normalize();
}

function addWireMarker(group: THREE.Group, position: THREE.Vector3) {
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.42, 28),
    new THREE.MeshStandardMaterial({ color: WIRE_COLOR, roughness: 0.45, metalness: 0.1 }),
  );
  wire.position.copy(position);
  wire.rotation.z = Math.PI / 2;
  group.add(wire);
}

function setOpacity(object: THREE.Object3D, opacity: number) {
  object.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.Line;
    if (!('material' in renderable) || !renderable.material) return;
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = false;
    });
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
