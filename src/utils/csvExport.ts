import type { PhysicsSample } from '../types/physics';
import type { VisionSample } from '../types/vision';

function escapeCsv(value: unknown) {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportScreenSamplesToCsv(samples: PhysicsSample[]) {
  downloadCsv('screen-roi-data.csv', [
    [
      'timestamp',
      'source',
      'channelId',
      'name',
      'symbol',
      'value',
      'displayValue',
      'rawValue',
      'unit',
      'method',
      'confidence',
      'durationMs',
      'rawText',
      'warning',
    ],
    ...samples.map((sample) => [
      (sample.timestamp / 1000).toFixed(3),
      sample.source,
      sample.channelId,
      sample.name,
      sample.symbol,
      sample.value,
      sample.displayValue ?? '',
      sample.rawValue ?? '',
      sample.unit,
      sample.method,
      sample.confidence ?? '',
      sample.durationMs ?? '',
      sample.rawText ?? '',
      sample.warning ?? '',
    ]),
  ]);
}

export function exportVisionSamplesToCsv(samples: VisionSample[]) {
  downloadCsv('camera-vision-data.csv', [
    [
      'timestamp',
      'source',
      'roiId',
      'name',
      'x',
      'y',
      'angle',
      'displacement',
      'velocity',
      'angularVelocity',
      'method',
      'confidence',
      'warning',
    ],
    ...samples.map((sample) => [
      (sample.timestamp / 1000).toFixed(3),
      sample.source,
      sample.roiId,
      sample.name,
      sample.x ?? '',
      sample.y ?? '',
      sample.angle ?? '',
      sample.displacement ?? '',
      sample.velocity ?? '',
      sample.angularVelocity ?? '',
      sample.method,
      sample.confidence ?? '',
      sample.warning ?? '',
    ]),
  ]);
}
