import type { ParcelView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { PayoutWatch } from './payoutWatch';

const parcel = (id: string, income?: { at: number; coins: number }): ParcelView => ({
  id,
  col: 0,
  row: 0,
  ownerId: 'a',
  shares: { a: 100 },
  facility: { kind: 'ad', contents: 0, expiresIn: [], orientation: 'north_south' as const, ...(income ? { income } : {}) },
});

describe('PayoutWatch', () => {
  it('does not count what the first snapshot already holds', () => {
    const watch = new PayoutWatch();

    const fresh = watch.fresh([parcel('L1-1', { at: 60, coins: 20 })]);

    expect(fresh).toEqual([]);
  });

  it('reports a payout whose payday is later than the one seen', () => {
    const watch = new PayoutWatch();
    watch.fresh([parcel('L1-1', { at: 60, coins: 20 }), parcel('L1-2', { at: 60, coins: 5 })]);

    const fresh = watch.fresh([parcel('L1-1', { at: 90, coins: 24 }), parcel('L1-2', { at: 60, coins: 5 })]);

    expect(fresh).toEqual([{ parcelId: 'L1-1', coins: 24 }]);
  });

  it('reports a payout once, however many snapshots repeat it', () => {
    const watch = new PayoutWatch();
    watch.fresh([parcel('L1-1')]);
    const paid = [parcel('L1-1', { at: 30, coins: 7 })];

    const first = watch.fresh(paid);
    const again = watch.fresh(paid);

    expect([first.length, again.length]).toEqual([1, 0]);
  });

  it('reports the first payout of a facility that had none before', () => {
    const watch = new PayoutWatch();
    watch.fresh([parcel('L1-1', { at: 60, coins: 20 }), parcel('L1-2')]);

    const fresh = watch.fresh([parcel('L1-1', { at: 60, coins: 20 }), parcel('L1-2', { at: 90, coins: 4 })]);

    expect(fresh).toEqual([{ parcelId: 'L1-2', coins: 4 }]);
  });

  it('reports a payout again when the facility had gone unpaid in between', () => {
    const watch = new PayoutWatch();
    watch.fresh([parcel('L1-1', { at: 30, coins: 7 })]);
    watch.fresh([parcel('L1-1')]);

    const fresh = watch.fresh([parcel('L1-1', { at: 90, coins: 9 })]);

    expect(fresh).toEqual([{ parcelId: 'L1-1', coins: 9 }]);
  });

  it('treats a payday that went back as a new game and stays quiet', () => {
    const watch = new PayoutWatch();
    watch.fresh([parcel('L1-1', { at: 600, coins: 20 })]);

    const restarted = watch.fresh([parcel('L1-1', { at: 30, coins: 3 })]);
    const next = watch.fresh([parcel('L1-1', { at: 60, coins: 3 })]);

    expect([restarted.length, next.length]).toEqual([0, 1]);
  });
});
