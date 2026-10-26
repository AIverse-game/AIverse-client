import { parseDecision, type Observation, type PrivatePlayer } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { createScriptedAgent } from './scripted';

function observation(self: Partial<PrivatePlayer>): Observation {
  const me: PrivatePlayer = {
    id: 'a', name: 'A', color: '#fff', zone: 'home', coins: 100, lastAction: null,
    stamina: 6, inventory: { grain: 0, wood: 0, bread: 2 }, ...self,
  };
  return {
    decidingRound: 1,
    world: {
      round: 0, maxRounds: 60, maxStamina: 6, inventoryCapacity: 20, zones: [], players: [me], self: me,
    },
    recentEvents: [],
    agent: { lastOutcome: null, lastError: null, note: null },
    memory: null,
  };
}

describe('scripted agents', () => {
  const selfSufficient = createScriptedAgent('self-sufficient');

  it('produce protocol-valid decisions', () => {
    for (const strategy of ['self-sufficient', 'grain-gatherer', 'wood-gatherer'] as const) {
      expect(parseDecision(createScriptedAgent(strategy).decide(observation({}))).ok).toBe(true);
    }
  });

  it('head home to rest when tired, eating bread only if they have some', () => {
    expect(selfSufficient.decide(observation({ zone: 'farm', stamina: 1 })).action).toEqual({ type: 'move', to: 'home' });
    expect(selfSufficient.decide(observation({ stamina: 0 })).action).toEqual({ type: 'rest', useBread: true });
    expect(selfSufficient.decide(observation({ stamina: 0, inventory: { grain: 0, wood: 0, bread: 0 } })).action)
      .toEqual({ type: 'rest', useBread: false });
  });

  it('self-sufficient agent crafts once it holds a full recipe', () => {
    const decision = selfSufficient.decide(observation({ zone: 'workshop', inventory: { grain: 2, wood: 1, bread: 0 } }));
    expect(decision.action).toEqual({ type: 'craft' });
  });

  it('gatherers stop gathering when the bag is nearly full', () => {
    const full = observation({ zone: 'farm', inventory: { grain: 18, wood: 0, bread: 0 } });
    expect(createScriptedAgent('grain-gatherer').decide(full).action).toEqual({ type: 'wait' });
  });
});
