import * as THREE from 'three';
import type { MagneticFieldConfig, MagneticFieldDetectionResult } from '../types/vision';
import type { VisualizationTheme } from './ForceVisualization3D';
import { createTextSprite } from './ForceArrow3D';

const WIRE_COLOR = '#d6dee8';
const FIELD_LINE_SPACING_MULTIPLIER = 3;
const FIELD_LINE_LENGTH_MULTIPLIER = 0.7;
const FIELD_SIDE_AVOIDANCE_OFFSET = 0.22;

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
) {
  const group = new THREE.Group();
  const colors = FIELD_THEME_COLORS[theme];
  const wirePosition = new THREE.Vector3(...config.wirePosition3D);
  const direction = getMagneticFieldDirection3D(detection);
  const yzPerpendicular = new THREE.Vector3(0, -direction.z, direction.y).normalize();
  const wireAxisOffset = new THREE.Vector3(1, 0, 0);
  const count = Math.max(2, Math.min(12, config.fieldLineCount));
  const length = Math.max(1.0, config.fieldLineLength * FIELD_LINE_LENGTH_MULTIPLIER);
  const spacing = Math.max(0.12, config.fieldLineSpacing * FIELD_LINE_SPACING_MULTIPLIER);
  const groupSideOffset = yzPerpendicular.clone().multiplyScalar(FIELD_SIDE_AVOIDANCE_OFFSET);

  addWireMarker(group, wirePosition);

  for (let index = 0; index < count; index += 1) {
    const centeredIndex = index - (count - 1) / 2;
    const wireOffset = centeredIndex * Math.min(spacing * 0.18, 0.22);
    const sideOffset = centeredIndex * spacing * 0.26;
    const center = wirePosition
      .clone()
      .add(wireAxisOffset.clone().multiplyScalar(wireOffset))
      .add(yzPerpendicular.clone().multiplyScalar(sideOffset))
      .add(groupSideOffset);
    const start = center.clone().add(direction.clone().multiplyScalar(-length / 2));
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, length * 0.86, 14),
      new THREE.MeshBasicMaterial({ color: colors.line, transparent: true, opacity: colors.shaftOpacity }),
    );
    shaft.position.copy(start.clone().add(direction.clone().multiplyScalar((length * 0.86) / 2)));
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    group.add(shaft);
    const arrow = new THREE.ArrowHelper(direction, start, length, colors.head, 0.34, 0.2);
    setOpacity(arrow, colors.arrowOpacity);
    group.add(arrow);
  }

  const label = createTextSprite('B', colors.label);
  label.scale.set(2.1, 0.58, 1);
  label.position.copy(
    wirePosition
      .clone()
      .add(groupSideOffset)
      .add(yzPerpendicular.clone().multiplyScalar(spacing * 0.58))
      .add(direction.clone().multiplyScalar(length * 0.34))
      .add(new THREE.Vector3(0.18, 0.24, 0.12)),
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
