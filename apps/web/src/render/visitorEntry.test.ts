import { describe, expect, it } from 'vitest';
import { ARRIVAL_GAP_MS, ARRIVAL_REACH, ENTRY_SECONDS, entryPose, newArrivals } from './visitorEntry';

const entrance = { x: 75, y: 75 };
const at = (id: number, x: number, y = 75) => ({ id, position: { x, y } });
/** The message seen just before: visitors 1 and 2 in town, 2 s before the next push. */
const before = { receivedAt: 10_000, visitors: [at(1, 90), at(2, 60)] };
const next = (...visitors: ReturnType<typeof at>[]) => ({ receivedAt: 12_000, visitors });

describe('entryPose', () => {
  it('starts all but invisible, two full turns round and with the beam dark', () => {
    const pose = entryPose(0);

    expect(pose!.size).toBeGreaterThan(0);
    expect(pose!.size).toBeLessThan(0.01);
    expect(pose!.spin).toBeCloseTo(Math.PI * 4);
    expect(pose!.beam).toBeCloseTo(0);
  });

  it('is half grown with the beam at its brightest halfway through', () => {
    const pose = entryPose(ENTRY_SECONDS / 2);

    expect(pose).toEqual({ size: 0.5, spin: Math.PI * 2, beam: 1 });
  });

  it('is over once the visitor stands full size', () => {
    expect(entryPose(ENTRY_SECONDS)).toBeNull();
  });

  it('treats a clock that reads before the first sight as the start', () => {
    expect(entryPose(-0.5)).toEqual(entryPose(0));
  });
});

describe('newArrivals', () => {
  it('picks out the visitors that were not there before and are near the entrance', () => {
    const after = next(at(1, 91), at(2, 59), at(3, 77), at(4, 75, 75 - ARRIVAL_REACH));

    expect(newArrivals(before, after, entrance)).toEqual([3, 4]);
  });

  it('does not count a visitor that was already there, even one back by the entrance', () => {
    const after = next(at(1, 76), at(3, 77));

    expect(newArrivals(before, after, entrance)).toEqual([3]);
  });

  it('lets a new visitor already far from the entrance simply appear', () => {
    expect(newArrivals(before, next(at(5, 75 + ARRIVAL_REACH + 0.1)), entrance)).toEqual([]);
  });

  it('counts nobody as just come in on the first message the page sees', () => {
    expect(newArrivals(null, next(at(3, 76)), entrance)).toEqual([]);
  });

  it('counts nobody when the message before was seen too long ago to tell, as after a tab in the background', () => {
    const late = { ...next(at(3, 76)), receivedAt: before.receivedAt + ARRIVAL_GAP_MS + 1 };

    expect(newArrivals(before, late, entrance)).toEqual([]);
  });

  it('counts nobody before the page knows where the entrance is', () => {
    expect(newArrivals(before, next(at(3, 76)), null)).toEqual([]);
  });
});
