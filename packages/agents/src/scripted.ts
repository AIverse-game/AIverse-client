import type { Action, Decision, Observation, PrivatePlayer, ZoneId } from '@aiverse/protocol';

// Debug rule agents: fixed heuristics that exercise the round loop before real
// models are connected. They know the default recipes and are not tuned for profit.

export type Strategy = 'self-sufficient' | 'grain-gatherer' | 'wood-gatherer';

const WORK_STAMINA = 2;
const BAG_MARGIN = 3;

function at(self: PrivatePlayer, zone: ZoneId, action: Action, note: string): Decision {
  return self.zone === zone ? { action, note } : { action: { type: 'move', to: zone }, note: `前往目标：${note}` };
}

function restIfTired(self: PrivatePlayer): Decision | null {
  if (self.stamina >= WORK_STAMINA) return null;
  return at(self, 'home', { type: 'rest', useBread: self.inventory.bread > 0 }, '体力不足，回家休息');
}

function bagNearlyFull(observation: Observation): boolean {
  const { self, inventoryCapacity } = observation.world;
  const used = self.inventory.grain + self.inventory.wood + self.inventory.bread;
  return used + BAG_MARGIN > inventoryCapacity;
}

const strategies: Record<Strategy, (observation: Observation) => Decision> = {
  'self-sufficient': (observation) => {
    const { self } = observation.world;
    const tired = restIfTired(self);
    if (tired) return tired;
    const { grain, wood } = self.inventory;
    if (grain >= 2 && wood >= 1) return at(self, 'workshop', { type: 'craft' }, '原料齐了，做面包');
    if (bagNearlyFull(observation)) return { action: { type: 'wait' }, note: '背包快满，暂停' };
    if (grain < 2) return at(self, 'farm', { type: 'gather' }, '采集谷物');
    return at(self, 'forest', { type: 'gather' }, '采集木材');
  },
  'grain-gatherer': (observation) => gatherer(observation, 'farm', '专心种谷物'),
  'wood-gatherer': (observation) => gatherer(observation, 'forest', '专心伐木'),
};

function gatherer(observation: Observation, zone: ZoneId, note: string): Decision {
  const { self } = observation.world;
  const tired = restIfTired(self);
  if (tired) return tired;
  if (bagNearlyFull(observation)) return { action: { type: 'wait' }, note: '背包快满，等市场开放' };
  return at(self, zone, { type: 'gather' }, note);
}

export function createScriptedAgent(strategy: Strategy): { decide(observation: Observation): Decision } {
  const decide = strategies[strategy];
  return { decide };
}
