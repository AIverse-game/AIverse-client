import { EventLog } from './EventLog';
import { Leaderboard } from './Leaderboard';
import { SelfPanel } from './SelfPanel';
import { TopBar } from './TopBar';
import { TownView } from './TownView';

export function App() {
  return (
    <div className="app">
      <TopBar />
      <main className="layout">
        <section className="stage" aria-label="小镇地图">
          <TownView />
        </section>
        <aside className="sidebar">
          <SelfPanel />
          <Leaderboard />
          <EventLog />
        </aside>
      </main>
    </div>
  );
}
