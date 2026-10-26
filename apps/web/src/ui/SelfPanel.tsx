import { ITEM_IDS } from '@aiverse/protocol';
import { ITEM_NAMES, OUTCOME_NAMES, ZONE_NAMES } from '../labels';
import { useGameState } from '../state/react';

export function SelfPanel() {
  const { world, agent } = useGameState();
  const self = world?.self;
  if (!world || !self) {
    return (
      <section className="panel">
        <h2>我的居民</h2>
        <p className="muted">观战中</p>
      </section>
    );
  }
  const used = ITEM_IDS.reduce((sum, item) => sum + self.inventory[item], 0);

  return (
    <section className="panel">
      <h2>
        <span className="swatch" style={{ background: self.color }} />
        {self.name}
        <span className="muted"> · {ZONE_NAMES[self.zone]}</span>
      </h2>
      <dl className="stats">
        <dt>金币</dt>
        <dd>{self.coins}</dd>
        <dt>体力</dt>
        <dd>
          <meter min={0} max={world.maxStamina} value={self.stamina} /> {self.stamina}/{world.maxStamina}
        </dd>
        <dt>背包</dt>
        <dd>
          {ITEM_IDS.map((item) => `${ITEM_NAMES[item]} ${self.inventory[item]}`).join(' · ')}
          <span className="muted">（{used}/{world.inventoryCapacity}）</span>
        </dd>
        <dt>AI</dt>
        <dd>
          {agent?.lastOutcome ? OUTCOME_NAMES[agent.lastOutcome] : '尚未决策'}
          {agent?.note && <div className="note">“{agent.note}”</div>}
          {agent?.lastError && <div className="error">{agent.lastError}</div>}
        </dd>
      </dl>
    </section>
  );
}
