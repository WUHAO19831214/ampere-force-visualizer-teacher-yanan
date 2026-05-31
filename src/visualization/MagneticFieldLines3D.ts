import * as THREE from 'three';
import type { MagneticFieldConfig, MagneticFieldDetectionResult } from '../types/vision';
import { createTextSprite } from './ForceArrow3D';

const FIELD_COLOR = '#7ddff4';
const WIRE_COLOR = '#d6dee8';

export function createMagneticFieldLinesGroup(
  detection: MagneticFieldDetectionResult | undefined,
  config: MagneticFieldConfig,
) {
  const group = new THREE.Group();
  const wirePosition = new THREE.Vector3(...config.wirePosition3D);
  const direction = getMagneticFieldDirection3D(detection);
  const yzPerpendicular = new THREE.Vector3(0, -direction.z, direction.y).normalize();
  const wireAxisOffset = new THREE.Vector3(1, 0, 0);
  const count = Math.max(2, Math.min(12, config.fieldLineCount));
  const length = Math.max(1.4, config.fieldLineLength);
  const spacing = Math.max(0.12, config.fieldLineSpacing);

  addWireMarker(group, wirePosition);

  for (let index = 0; index < count; index += 1) {
    const centeredIndex = index - (count - 1) / 2;
    const wireOffset = centeredIndex * Math.min(spacing * 0.42, 0.18);
    const sideOffset = (index % 2 === 0 ? -0.5 : 0.5) * spacing * 0.45;
    const center = wirePosition
      .clone()
      .add(wireAxisOffset.clone().multiplyScalar(wireOffset))
      .add(yzPerpendicular.clone().multiplyScalar(sideOffset));
    const start = center.clone().add(direction.clone().multiplyScalar(-length / 2));
    const arrow = new THREE.ArrowHelper(direction, start, length, FIELD_COLOR, 0.2, 0.11);
    setOpacity(arrow, 0.58);
    group.add(arrow);
  }

  const label = createTextSprite(detection?.fieldDirection2D ? '磁场 B' : '磁场 B（默认方向）', FIELD_COLOR);
  label.scale.set(0.74, 0.2, 1);
  label.position.copy(wirePosition.clone().add(direction.clone().multiplyScalar(length / 2 + 0.22)).add(new THREE.Vector3(0, 0.25, 0.2)));
  group.add(label);

  return group;
}

function getMagneticFieldDirection3D(detection?: MagneticFieldDetectionResult) {
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

  // 实验约定：摄像头画面平面被视为 3D 场景的 YZ 平面。
  // 屏幕向上对应 +Y，屏幕向右对应 +Z，导体棒沿 X 轴。
  // 因此 N→S 磁场方向只能映射到 YZ 平面内：B = [0, -dy, dx]。
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
  wire.rotation.x = Math.PI / 2;
  group.add(wire);

  const label = createTextSprite('导线 I', '#dbeafe');
  label.scale.set(0.58, 0.18, 1);
  label.position.copy(position.clone().add(new THREE.Vector3(0.16, -0.3, 0.24)));
  group.add(label);
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
