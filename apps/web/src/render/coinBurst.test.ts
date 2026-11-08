import { describe, expect, it } from 'vitest';
import {
  AMOUNT_LIFE, amountPose, burstDuration, COIN_FRAMES, COIN_LIFE, COIN_STAGGER, coinCount, coinPose, SPARK_LIFE, sparkPose,
} from './coinBurst';

describe('coinCount', () => {
  it.each([
    [1, 1],
    [9, 1],
    [10, 2],
    [49, 2],
    [50, 3],
    [150, 4],
    [500, 5],
    [100_000, 5],
  ])('shows a payout of %i coins with %i coin(s)', (coins, count) => {
    expect(coinCount(coins)).toBe(count);
  });
});

describe('coinPose', () => {
  it('is not there before it is thrown or after it is gone', () => {
    expect([coinPose(-0.01), coinPose(COIN_LIFE)]).toEqual([null, null]);
  });

  it('rises while it is thrown and keeps rising slowly while it hangs', () => {
    const thrown = coinPose(0.15)!.rise;
    const landed = coinPose(0.3)!.rise;
    const hanging = coinPose(0.5)!.rise;

    expect(thrown).toBeGreaterThan(0);
    expect(landed).toBeGreaterThan(thrown);
    expect(hanging).toBeGreaterThan(landed);
    expect(hanging - landed).toBeLessThan(landed - thrown);
  });

  it('shrinks to nothing as it goes and is full size before', () => {
    const early = coinPose(0.2)!.scale;
    const last = coinPose(COIN_LIFE - 0.01)!.scale;

    expect(early).toBe(1);
    expect(last).toBeLessThan(0.1);
  });

  it('turns through every frame of the half turn, staying in range', () => {
    const frames = new Set<number>();

    for (let age = 0; age < COIN_LIFE; age += 0.01) frames.add(coinPose(age)!.frame);

    expect([...frames].every((frame) => frame >= 0 && frame < COIN_FRAMES)).toBe(true);
    expect(frames.size).toBe(COIN_FRAMES);
  });
});

describe('sparkPose', () => {
  it('flies out, white at first and pale gold after, and is gone after its life', () => {
    const start = sparkPose(0.01)!;
    const late = sparkPose(SPARK_LIFE - 0.01)!;

    expect(start.white).toBe(true);
    expect(late.white).toBe(false);
    expect(late.distance).toBeGreaterThan(start.distance);
    expect([sparkPose(-0.1), sparkPose(SPARK_LIFE)]).toEqual([null, null]);
  });
});

describe('amountPose', () => {
  it('rises, stays solid for most of its life, then fades out', () => {
    const early = amountPose(0.1)!;
    const late = amountPose(AMOUNT_LIFE * 0.9)!;

    expect(early.opacity).toBe(1);
    expect(late.opacity).toBeCloseTo(1 / 3, 5);
    expect(late.rise).toBeGreaterThan(early.rise);
    expect(amountPose(AMOUNT_LIFE)).toBeNull();
  });
});

describe('burstDuration', () => {
  it('lasts until the last coin of the burst has ended in its sparks', () => {
    expect(burstDuration(5)).toBeCloseTo(4 * COIN_STAGGER + COIN_LIFE + SPARK_LIFE, 10);
  });

  it('is at least as long as the amount is shown', () => {
    expect(burstDuration(1)).toBe(AMOUNT_LIFE);
  });
});
