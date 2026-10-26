import type { Inventory, ItemId, ZoneId } from '@aiverse/protocol';

export interface ProductionSpec {
  item: ItemId;
  quantity: number;
  stamina: number;
}

export interface Rules {
  maxRounds: number;
  maxStamina: number;
  inventoryCapacity: number;
  startingCoins: number;
  startingStamina: number;
  startingInventory: Inventory;
  startZone: ZoneId;
  /** Undirected links; moving along one link takes one round. */
  links: ReadonlyArray<readonly [ZoneId, ZoneId]>;
  gather: Partial<Record<ZoneId, ProductionSpec>>;
  craft: { zone: ZoneId; inputs: Partial<Inventory>; output: ProductionSpec };
  rest: { zone: ZoneId; simpleGain: number };
}

// Starting values from docs/design/game-overview.md section 4; not yet balance-tested.
export const DEFAULT_RULES: Rules = {
  maxRounds: 60,
  maxStamina: 6,
  inventoryCapacity: 20,
  startingCoins: 100,
  startingStamina: 6,
  startingInventory: { grain: 0, wood: 0, bread: 2 },
  startZone: 'home',
  links: [
    ['market', 'farm'],
    ['market', 'forest'],
    ['market', 'workshop'],
    ['market', 'home'],
  ],
  gather: {
    farm: { item: 'grain', quantity: 3, stamina: 2 },
    forest: { item: 'wood', quantity: 2, stamina: 2 },
  },
  craft: {
    zone: 'workshop',
    inputs: { grain: 2, wood: 1 },
    output: { item: 'bread', quantity: 2, stamina: 2 },
  },
  rest: { zone: 'home', simpleGain: 2 },
};
