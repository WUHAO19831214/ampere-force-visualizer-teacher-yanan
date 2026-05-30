import { experimentDataActions, useExperimentDataStore } from '../store/useExperimentDataStore';
import { exportScreenSamplesToCsv, exportVisionSamplesToCsv } from '../utils/csvExport';
import { CsvExportButton } from './CsvExportButton';
import { LiveScreenDataPanel } from './LiveScreenDataPanel';
import { LiveVisionDataPanel } from './LiveVisionDataPanel';
import { OcrMethodComparisonPanel } from './OcrMethodComparisonPanel';

function useAdoptAllTesseract() {
  const store = useExperimentDataStore();
  return () => {
    store.screenRois.forEach((roi) => {
      const next = {
        ...roi,
        recognizerMethod: 'tesseract' as const,
        sampleRateHz: roi.sampleRateHz > 3 || roi.recognizerMethod !== 'tesseract' ? 2 : roi.sampleRateHz,
      };
      experimentDataActions.updateScreenRoi(next);
      experimentDataActions.clearLatestScreenValue(next.channelId);
      experimentDataActions.updateScreenRoiStatus(next.id, {
        name: next.name,
        symbol: next.symbol,
        method: 'tesseract',
        enabled: next.enabled,
        actualSampleRateHz: 0,
        failureCount: 0,
        warning: `${next.name} 已采用 Tesseract 实时识别，等待 OCR`,
      });
    });
  };
}

export function LiveDataOverviewPanel() {
  const store = useExperimentDataStore();
  const latestWarning = store.status.warnings[0];
  const adoptAllTesseract = useAdoptAllTesseract();

  return (
    <section className="panel panel-data live-overview-panel">
      <div className="panel-titlebar">
        <div>
          <h2>实时数据总览</h2>
        </div>
      </div>
      <div className="data-scroll">
        <LiveScreenDataPanel latestValues={store.latestScreenValues} roiStatuses={store.status.screenRoiStatuses} />
        <details className="advanced-tools-panel">
          <summary>高级设置 / 调试工具</summary>
          <div className="advanced-tools-content">
            <div className="overview-actions">
              <CsvExportButton
                label={`导出屏幕数据 CSV（${store.screenSamples.length}）`}
                onExport={() => exportScreenSamplesToCsv(store.screenSamples)}
                disabled={store.screenSamples.length === 0}
              />
              <CsvExportButton
                label={`导出摄像头数据 CSV（${store.visionSamples.length}）`}
                onExport={() => exportVisionSamplesToCsv(store.visionSamples)}
                disabled={store.visionSamples.length === 0}
              />
              <button className="danger-button" onClick={experimentDataActions.clearData}>
                清空数据
              </button>
              <button className="secondary-button" onClick={adoptAllTesseract} disabled={store.screenRois.length === 0}>
                全部采用 Tesseract 实时识别
              </button>
            </div>
            {latestWarning && (
              <div className="overview-warning" title={store.status.warnings.join('\n')}>
                Warning：{latestWarning}
              </div>
            )}
            <LiveVisionDataPanel latestValues={store.latestVisionValues} />
            <OcrMethodComparisonPanel />
          </div>
        </details>
      </div>
    </section>
  );
}
