import { useExperimentDataStore } from '../store/useExperimentDataStore';
import { LiveScreenDataPanel } from './LiveScreenDataPanel';

export function LiveDataOverviewPanel() {
  const store = useExperimentDataStore();

  return (
    <section className="panel panel-data live-overview-panel">
      <div className="data-scroll">
        <LiveScreenDataPanel latestValues={store.latestScreenValues} roiStatuses={store.status.screenRoiStatuses} />
      </div>
    </section>
  );
}
