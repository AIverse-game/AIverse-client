import { ActionPanel } from './ActionPanel';
import { MapPanel } from './MapPanel';
import { MapView } from './MapView';
import { TopBar } from './TopBar';

export function App() {
  return (
    <div className="app">
      <TopBar />
      <main className="layout">
        <section className="stage" aria-label="小镇地图">
          <MapView />
        </section>
        <aside className="sidebar">
          <MapPanel />
          <ActionPanel />
        </aside>
      </main>
    </div>
  );
}
