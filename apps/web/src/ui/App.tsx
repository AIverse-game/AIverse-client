import { ActionPanel } from './ActionPanel';
import { AgentPanel } from './AgentPanel';
import { AgentTimelinePanel } from './AgentTimelinePanel';
import { DealsPanel } from './DealsPanel';
import { ExchangePanel } from './ExchangePanel';
import { MapPanel } from './MapPanel';
import { MapView } from './MapView';
import { PriceChartPanel } from './PriceChartPanel';
import { RankingPanel } from './RankingPanel';
import { CollectorPanel } from './CollectorPanel';
import { SpeechPanel } from './SpeechPanel';
import { TopBar } from './TopBar';

export function App() {
  return (
    <div className="app">
      <TopBar />
      <main className="layout">
        <div className="stage-column">
          <section className="stage" aria-label="小镇地图">
            <MapView />
          </section>
          <AgentTimelinePanel />
        </div>
        <aside className="sidebar">
          <RankingPanel />
          <MapPanel />
          <ActionPanel />
          <PriceChartPanel />
          <ExchangePanel />
          <CollectorPanel />
          <DealsPanel />
          <AgentPanel />
          <SpeechPanel />
        </aside>
      </main>
    </div>
  );
}
