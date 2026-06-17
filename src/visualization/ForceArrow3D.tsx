import * as THREE from 'three';

export interface ForceArrowOptions {
  label: string;
  valueN: number;
  vector: THREE.Vector3;
  color: string | number;
  origin?: THREE.Vector3;
  opacity?: number;
  labelOffset?: THREE.Vector3;
  labelScale?: number;
  arrowScale?: number;
}

export function createForceArrowGroup({
  label,
  valueN,
  vector,
  color,
  origin = new THREE.Vector3(0, 0, 0),
  opacity = 1,
  labelOffset = new THREE.Vector3(0, 0.12, 0),
  labelScale = 1,
  arrowScale = 1,
}: ForceArrowOptions) {
  const group = new THREE.Group();
  const length = vector.length();

  if (length < 0.015) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 20, 20),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity }),
    );
    marker.position.copy(origin);
    group.add(marker);
  } else {
    const direction = vector.clone().normalize();
    const headLength = Math.min(0.62, Math.max(0.13, length * 0.18) * arrowScale);
    const headWidth = Math.min(0.48, Math.max(0.08, length * 0.11) * arrowScale);
    const shaftLength = Math.max(0.01, length - headLength * 0.58);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012 * arrowScale, 0.012 * arrowScale, shaftLength, 18),
      new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }),
    );
    shaft.position.copy(origin.clone().add(direction.clone().multiplyScalar(shaftLength / 2)));
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    group.add(shaft);
    const arrow = new THREE.ArrowHelper(direction, origin, length, color, headLength, headWidth);
    arrow.traverse((child) => applyOpacity(child, opacity));
    group.add(arrow);
  }

  const labelPosition = origin.clone().add(vector).add(labelOffset);
  const labelSprite = createTextSprite(`${label} = ${formatForce(valueN)} N`, color);
  labelSprite.scale.multiplyScalar(labelScale);
  labelSprite.position.copy(labelPosition);
  group.add(labelSprite);

  return group;
}

export function createDashedLine(start: THREE.Vector3, end: THREE.Vector3, color: string | number, opacity = 0.56) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.12,
    gapSize: 0.08,
    transparent: true,
    opacity,
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

export function createTextSprite(text: string, color: string | number, background: string | null = null) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 512;
  const height = 128;
  canvas.width = width;
  canvas.height = height;

  if (context) {
    context.clearRect(0, 0, width, height);
    if (background) {
      context.fillStyle = background;
      roundRect(context, 12, 18, width - 24, height - 36, 18);
      context.fill();
    }
    const segments = tokenizePhysicsText(text);
    const totalWidth = measurePhysicsText(context, segments);
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = 8;
    context.strokeStyle = 'rgba(5, 10, 16, 0.82)';
    drawPhysicsText(context, segments, (width - totalWidth) / 2, height / 2 + 2, true, color, background);
    context.fillStyle = background ? '#f7fbff' : toCssColor(color);
    drawPhysicsText(context, segments, (width - totalWidth) / 2, height / 2 + 2, false, color, background);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.26, 0.32, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function disposeObject3D(object: THREE.Object3D) {
  object.traverse((child) => {
    const disposable = child as THREE.Mesh | THREE.Line | THREE.Sprite;
    if ('geometry' in disposable && disposable.geometry) {
      disposable.geometry.dispose();
    }
    if ('material' in disposable && disposable.material) {
      const materials = Array.isArray(disposable.material) ? disposable.material : [disposable.material];
      materials.forEach((material) => {
        const maybeTextured = material as THREE.Material & { map?: THREE.Texture };
        maybeTextured.map?.dispose();
        material.dispose();
      });
    }
  });
}

function applyOpacity(object: THREE.Object3D, opacity: number) {
  const renderable = object as THREE.Mesh | THREE.Line;
  if (!('material' in renderable) || !renderable.material) return;
  const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
  materials.forEach((material) => {
    material.transparent = opacity < 1;
    material.opacity = opacity;
  });
}

function formatForce(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function toCssColor(color: string | number) {
  return typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
}

interface TextSegment {
  text: string;
  subscript?: boolean;
}

function tokenizePhysicsText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern = /F_(安培力|磁场力|[xyz])/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index) });
    segments.push({ text: 'F' });
    segments.push({ text: match[1], subscript: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

function setSegmentFont(context: CanvasRenderingContext2D, subscript?: boolean) {
  context.font = subscript
    ? 'italic 700 30px "Times New Roman", "Microsoft YaHei", serif'
    : 'italic 700 48px "Times New Roman", "Microsoft YaHei", serif';
}

function measurePhysicsText(context: CanvasRenderingContext2D, segments: TextSegment[]) {
  return segments.reduce((width, segment) => {
    setSegmentFont(context, segment.subscript);
    return width + context.measureText(segment.text).width;
  }, 0);
}

function drawPhysicsText(
  context: CanvasRenderingContext2D,
  segments: TextSegment[],
  startX: number,
  centerY: number,
  stroke: boolean,
  color: string | number,
  background: string | null,
) {
  let x = startX;
  segments.forEach((segment) => {
    setSegmentFont(context, segment.subscript);
    const y = centerY + (segment.subscript ? 15 : 0);
    if (stroke) {
      context.strokeText(segment.text, x, y);
    } else {
      context.fillStyle = background ? '#f7fbff' : toCssColor(color);
      context.fillText(segment.text, x, y);
    }
    x += context.measureText(segment.text).width;
  });
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
