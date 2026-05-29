import type { NumberRecognizer, RecognizeInput, RecognizeResult } from '../types/physics';
import { extractNumberFromText } from '../utils/extractNumber';
import { imageDataToCanvas, imageDataToDataUrl } from '../utils/imagePreprocess';
import Tesseract from 'tesseract.js';

type TesseractWorker = Awaited<ReturnType<typeof Tesseract.createWorker>>;
export type TesseractRuntimeState = 'not-loaded' | 'loading' | 'ready' | 'recognizing' | 'error';

export interface TesseractRuntimeStatus {
  state: TesseractRuntimeState;
  error?: string;
}

let workerPromise: Promise<TesseractWorker> | null = null;
let recognizeQueue: Promise<unknown> = Promise.resolve();
let runtimeStatus: TesseractRuntimeStatus = { state: 'not-loaded' };
const statusListeners = new Set<(status: TesseractRuntimeStatus) => void>();

function setRuntimeStatus(next: TesseractRuntimeStatus) {
  runtimeStatus = next;
  statusListeners.forEach((listener) => listener(runtimeStatus));
}

export function getTesseractRuntimeStatus() {
  return runtimeStatus;
}

export function subscribeTesseractRuntimeStatus(listener: (status: TesseractRuntimeStatus) => void) {
  statusListeners.add(listener);
  listener(runtimeStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

async function getWorker() {
  if (!workerPromise) {
    setRuntimeStatus({ state: 'loading' });
    workerPromise = Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY)
      .then(async (worker) => {
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789.-',
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
          preserve_interword_spaces: '0',
          user_defined_dpi: '300',
        });
        setRuntimeStatus({ state: 'ready' });
        return worker;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Tesseract worker 加载失败';
        workerPromise = null;
        setRuntimeStatus({ state: 'error', error: message });
        throw error;
      });
  }
  return workerPromise;
}

export class TesseractRecognizer implements NumberRecognizer {
  async recognize(input: RecognizeInput): Promise<RecognizeResult> {
    const roiConfig = input.roiConfig;
    const started = performance.now();
    const rawImageDataUrl = imageDataToDataUrl(input.croppedImageData);
    const processedImageDataUrl = imageDataToDataUrl(input.preprocessedImageData);

    const runRecognition = async (): Promise<RecognizeResult> => {
      try {
        const worker = await getWorker();
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789.-',
          tessedit_pageseg_mode: mapPsmMode(roiConfig.psmMode),
        });
        setRuntimeStatus({ state: 'recognizing' });
        const result = await worker.recognize(imageDataToCanvas(input.preprocessedImageData));
        const rawText = result.data.text.trim();
        const value = extractNumberFromText(rawText);
        const durationMs = Math.round(performance.now() - started);
        const confidence = Number((Math.max(0, Math.min(100, result.data.confidence)) / 100).toFixed(3));
        const warning = value === null ? `${roiConfig.name} OCR 未能从 rawText 中提取普通小数` : undefined;
        const testedAt = Date.now();
        setRuntimeStatus({ state: 'ready' });

        return {
          method: 'tesseract',
          value,
          rawText,
          confidence,
          durationMs,
          warning,
          testedAt,
          debug: {
            roiId: roiConfig.id,
            roiName: roiConfig.name,
            ocrRoi: roiConfig.ocrRoi,
            rawImageDataUrl,
            processedImageDataUrl,
            rawText,
            value,
            confidence,
            durationMs,
            warning,
            method: 'tesseract',
            trigger: 'sampling',
            testedAt,
            timestamp: testedAt,
          },
        };
      } catch (error) {
        const durationMs = Math.round(performance.now() - started);
        const warning = error instanceof Error ? error.message : `${roiConfig.name} Tesseract OCR 调用失败`;
        const testedAt = Date.now();
        setRuntimeStatus({ state: 'error', error: warning });
        return {
          method: 'tesseract',
          value: null,
          rawText: '',
          confidence: 0,
          durationMs,
          warning,
          error: warning,
          testedAt,
          debug: {
            roiId: roiConfig.id,
            roiName: roiConfig.name,
            ocrRoi: roiConfig.ocrRoi,
            rawImageDataUrl,
            processedImageDataUrl,
            rawText: '',
            value: null,
            confidence: 0,
            durationMs,
            warning,
            error: warning,
            method: 'tesseract',
            trigger: 'sampling',
            testedAt,
            timestamp: testedAt,
          },
        };
      }
    };

    const queued = recognizeQueue.then(runRecognition, runRecognition);
    recognizeQueue = queued.catch(() => undefined);
    return queued;
  }
}

function mapPsmMode(mode: string) {
  if (mode === 'SINGLE_WORD') return Tesseract.PSM.SINGLE_WORD;
  if (mode === 'SINGLE_BLOCK') return Tesseract.PSM.SINGLE_BLOCK;
  return Tesseract.PSM.SINGLE_LINE;
}
