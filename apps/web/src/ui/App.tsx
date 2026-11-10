import { useState } from 'react';
import { ActionPanel } from './ActionPanel';
import { AgentPanel } from './AgentPanel';
import { AgentTimelinePanel } from './AgentTimelinePanel';
import { DealsPanel } from './DealsPanel';
import { ExchangePanel } from './ExchangePanel';
import { FacilityPanel } from './FacilityPanel';
import { MapPanel } from './MapPanel';
import { MapView } from './MapView';
import { RankingPanel } from './RankingPanel';
import { SpeechPanel } from './SpeechPanel';
import { TopBar } from './TopBar';
import { WorldLogPanel } from './WorldLogPanel';

/** The map fills the screen; the top bar, the side panels and the world log float over it. */
export function App() {
  const [logOpen, setLogOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(true);

  return (
    <div className={panelsOpen ? 'app' : 'app panels-hidden'}>
      <section className="stage" aria-label="小镇地图">
        <MapView />
      </section>
      <TopBar
        logOpen={logOpen}
        onToggleLog={() => setLogOpen((open) => !open)}
        panelsOpen={panelsOpen}
        onTogglePanels={() => setPanelsOpen((open) => !open)}
      />
      {logOpen && <WorldLogPanel onClose={() => setLogOpen(false)} />}
      {panelsOpen && (
        <aside className="sidebar" aria-label="操作面板">
          <RankingPanel />
          <MapPanel />
          <FacilityPanel />
          <ActionPanel />
          <ExchangePanel />
          <DealsPanel />
          <AgentPanel />
          <AgentTimelinePanel />
          <SpeechPanel />
        </aside>
      )}
    </div>
  );
}
