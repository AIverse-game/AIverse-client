export const ZONE_IDS = ['market', 'farm', 'forest', 'workshop', 'home'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export const ITEM_IDS = ['grain', 'wood', 'bread'] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export type PlayerId = string;

export type Inventory = Record<ItemId, number>;
