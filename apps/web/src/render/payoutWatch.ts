import type { ParcelView } from '@aiverse/protocol';

export interface Payout {
  parcelId: string;
  coins: number;
}

/**
 * Tells which facilities have been paid since it last looked. A snapshot only says what each facility
 * was paid at its latest payday, and `at` is that payday's game time, so a payout is new when its `at`
 * is later than the one seen before. What the first snapshot already holds happened before the page
 * was here and is not new; an `at` that went back means a new game, which starts over without a payout.
 */
export class PayoutWatch {
  private readonly seen = new Map<string, number>();
  private primed = false;

  /** The payouts in `parcels` that were not in the snapshots before it. */
  fresh(parcels: readonly ParcelView[]): Payout[] {
    const fresh: Payout[] = [];
    const present = new Set<string>();
    for (const parcel of parcels) {
      const income = parcel.facility?.income;
      if (!income) continue;
      present.add(parcel.id);
      const before = this.seen.get(parcel.id);
      if (this.primed && (before === undefined || income.at > before)) fresh.push({ parcelId: parcel.id, coins: income.coins });
      this.seen.set(parcel.id, income.at);
    }
    for (const id of [...this.seen.keys()]) if (!present.has(id)) this.seen.delete(id);
    this.primed = true;
    return fresh;
  }
}
