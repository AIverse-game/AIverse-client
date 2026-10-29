import { ActionPanel } from './ActionPanel';
import { MapPanel } from './MapPanel';
import { MapView } from './MapView';
import { RankingPanel } from './RankingPanel';
import { SpeechPanel } from './SpeechPanel';
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
          <RankingPanel />
          <MapPanel />
          <ActionPanel />
          <SpeechPanel />
        </aside>
      </main>
    </div>
  );
}
