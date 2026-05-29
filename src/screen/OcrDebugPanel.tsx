import type { OcrDebugInfo, RoiConfig } from '../types/physics';
import type { TesseractRuntimeStatus } from '../recognizers/TesseractRecognizer';

interface OcrDebugPanelProps {
  rois: RoiConfig[];
  debugByRoi: Record<string, OcrDebugInfo>;
  selectedId?: string;
  tesseractStatus: TesseractRuntimeStatus;
  isTesting?: boolean;
  onTestCurrentRoi: () => void;
}

function tesseractStatusText(status: TesseractRuntimeStatus) {
  const map: Record<TesseractRuntimeStatus['state'], string> = {
    'not-loaded': 'Tesseract 未加载',
    loading: 'Tesseract 加载中',
    ready: 'Tesseract 已就绪',
    recognizing: 'Tesseract 识别中',
    error: 'Tesseract 错误',
  };
  return status.error ? `${map[status.state]}：${status.error}` : map[status.state];
}

function sourceNote(roi: RoiConfig, debug?: OcrDebugInfo) {
  if (roi.recognizerMethod === 'mock' && debug?.method === 'mock') {
    return '当前为 mock 模式，rawText/value 为模拟数据，不代表 OCR 结果。';
  }
  if (roi.recognizerMethod === 'mock' && debug?.method === 'tesseract') {
    return '当前配置为 mock；下方是单次测试真实 OCR 结果，不会写入实时数据。';
  }
  if (roi.recognizerMethod === 'tesseract') {
    return '当前为 tesseract 模式，rawText/value 来自真实 OCR。';
  }
  if (roi.recognizerMethod === 'cnn-onnx') {
    return '当前为 cnn-onnx-placeholder，模型尚未接入。';
  }
  return 'template-digit 固定字体模板识别器已预留，当前尚未实现。';
}

export function OcrDebugPanel({ rois, debugByRoi, selectedId, tesseractStatus, isTesting, onTestCurrentRoi }: OcrDebugPanelProps) {
  return (
    <details className="config-drawer ocr-debug-drawer">
      <summary>OCR 调试面板</summary>
      <div className="ocr-debug-toolbar">
        <span>{tesseractStatusText(tesseractStatus)}</span>
        <button onClick={onTestCurrentRoi} disabled={isTesting || !selectedId}>
          {isTesting ? '正在测试 OCR...' : '测试当前 ROI OCR'}
        </button>
      </div>
      <div className="ocr-debug-list">
        {rois.map((roi) => {
          const debug = debugByRoi[roi.id];
          return (
            <article className={`ocr-debug-card ${selectedId === roi.id ? 'selected-debug-card' : ''}`} key={roi.id}>
              <div className="ocr-debug-head">
                <strong>{roi.name}</strong>
                <span>{debug?.method ?? roi.recognizerMethod}</span>
              </div>
              <p className="ocr-source-note">{sourceNote(roi, debug)}</p>
              <dl>
                <div>
                  <dt>ocrRoi</dt>
                  <dd>
                    x {roi.ocrRoi.x.toFixed(3)} / y {roi.ocrRoi.y.toFixed(3)} / w {roi.ocrRoi.width.toFixed(3)} / h{' '}
                    {roi.ocrRoi.height.toFixed(3)}
                  </dd>
                </div>
                <div>
                  <dt>视频像素 ROI</dt>
                  <dd>
                    {debug?.videoPixelRoi
                      ? `x ${Math.round(debug.videoPixelRoi.x)} / y ${Math.round(debug.videoPixelRoi.y)} / w ${Math.round(debug.videoPixelRoi.width)} / h ${Math.round(debug.videoPixelRoi.height)}`
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt>rawText</dt>
                  <dd>{debug?.rawText || '-'}</dd>
                </div>
                <div>
                  <dt>value</dt>
                  <dd>{debug?.value ?? '-'}</dd>
                </div>
                <div>
                  <dt>confidence</dt>
                  <dd>{debug?.confidence?.toFixed(3) ?? '-'}</dd>
                </div>
                <div>
                  <dt>durationMs</dt>
                  <dd>{debug?.durationMs ?? '-'}</dd>
                </div>
                <div>
                  <dt>物理校验</dt>
                  <dd>{debug?.validationPassed === undefined ? '-' : debug.validationPassed ? '通过' : '未通过'}</dd>
                </div>
                <div>
                  <dt>失败次数</dt>
                  <dd>{debug?.failureCount ?? 0}</dd>
                </div>
                <div>
                  <dt>warning</dt>
                  <dd>{debug?.warning || '-'}</dd>
                </div>
              </dl>
              <div className="ocr-debug-images">
                <figure>
                  {debug?.rawImageDataUrl ? <img src={debug.rawImageDataUrl} alt={`${roi.name} 裁剪原图`} /> : <div />}
                  <figcaption>裁剪原图</figcaption>
                </figure>
                <figure>
                  {debug?.processedImageDataUrl ? <img src={debug.processedImageDataUrl} alt={`${roi.name} 预处理图`} /> : <div />}
                  <figcaption>预处理图</figcaption>
                </figure>
              </div>
            </article>
          );
        })}
      </div>
    </details>
  );
}
