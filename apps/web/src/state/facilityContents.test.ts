import { expect, it } from 'vitest';
import { activeContents } from './facilityContents';

it('drops stale interior items between authority snapshots', () => {
  const facility = { kind: 'game_hall' as const, contents: 2, expiresIn: [2, 300], orientation: 'north_south' as const };
  expect(activeContents(facility, (seconds) => Math.max(0, seconds - 1))).toBe(2);
  expect(activeContents(facility, (seconds) => Math.max(0, seconds - 3))).toBe(1);
});
