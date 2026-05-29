import { ResizableThreePanelLayout } from './components/layout/ResizableThreePanelLayout';
import { ScreenCapturePanel } from './screen/ScreenCapturePanel';
import { CameraCapturePanel } from './camera/CameraCapturePanel';
import { LiveDataOverviewPanel } from './data/LiveDataOverviewPanel';
import { ThreeDVisualizationPanel } from './visualization/ThreeDVisualizationPanel';

export default function App() {
  return (
    <ResizableThreePanelLayout
      left={<ScreenCapturePanel />}
      middle={<CameraCapturePanel />}
      rightTop={<LiveDataOverviewPanel />}
      rightBottom={<ThreeDVisualizationPanel />}
    />
  );
}
