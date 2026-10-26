import { ZONE_IDS, type ZoneId } from '@aiverse/protocol';
import type { Rules } from './rules';

export function neighborsOf(rules: Rules, zone: ZoneId): ZoneId[] {
  const result: ZoneId[] = [];
  for (const [a, b] of rules.links) {
    if (a === zone) result.push(b);
    else if (b === zone) result.push(a);
  }
  return result;
}

/** First step on a shortest path from `from` to `to`, or null if unreachable or equal. */
export function nextHop(rules: Rules, from: ZoneId, to: ZoneId): ZoneId | null {
  if (from === to) return null;
  // Breadth-first search, remembering which first step reached each zone.
  const firstStep = new Map<ZoneId, ZoneId>();
  const queue: ZoneId[] = [];
  for (const neighbor of neighborsOf(rules, from)) {
    if (!firstStep.has(neighbor)) {
      firstStep.set(neighbor, neighbor);
      queue.push(neighbor);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const zone = queue[i]!;
    if (zone === to) return firstStep.get(zone)!;
    for (const neighbor of neighborsOf(rules, zone)) {
      if (neighbor !== from && !firstStep.has(neighbor)) {
        firstStep.set(neighbor, firstStep.get(zone)!);
        queue.push(neighbor);
      }
    }
  }
  return null;
}

export function assertConnected(rules: Rules): void {
  for (const zone of ZONE_IDS) {
    if (zone !== rules.startZone && nextHop(rules, rules.startZone, zone) === null) {
      throw new Error(`zone ${zone} is unreachable from ${rules.startZone}`);
    }
  }
}
