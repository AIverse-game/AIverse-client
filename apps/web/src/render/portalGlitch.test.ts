import { describe, expect, it } from 'vitest';
import { GHOST_SECONDS, glitchFrame, glitchHash, GLITCH_SECONDS, GLITCH_STEP, SLICES, type GlitchFrame } from './portalGlitch';

const ages = Array.from({ length: Math.round(GLITCH_SECONDS / GLITCH_STEP) }, (_, step) => (step + 0.5) * GLITCH_STEP);

describe('glitchFrame', () => {
  it('starts at full strength with the visitor shown', () => {
    const frame = glitchFrame(0, 3);

    expect(frame!.strength).toBe(1);
    expect(frame!.shown).toBe(true);
  });

  it('is over once the glitch has run its time', () => {
    expect(glitchFrame(GLITCH_SECONDS, 3)).toBeNull();
  });

  it('is nothing before the visitor goes through', () => {
    expect(glitchFrame(-0.01, 3)).toBeNull();
  });

  it('holds one look for a whole step and then jumps', () => {
    const seed = 11;

    const early = glitchFrame(GLITCH_STEP * 2 + 0.001, seed);
    const late = glitchFrame(GLITCH_STEP * 3 - 0.001, seed);

    expect(late).toEqual(early);
  });

  it('plays the same for the same visitor every time', () => {
    expect(glitchFrame(0.27, 42)).toEqual(glitchFrame(0.27, 42));
  });

  it('dies down: weaker, and shaking and tearing less, as it goes on', () => {
    const seeds = Array.from({ length: 40 }, (_, seed) => seed);
    const total = (age: number, measure: (frame: GlitchFrame) => number) => seeds.reduce((sum, seed) => sum + measure(glitchFrame(age, seed)!), 0);
    const torn = (frame: GlitchFrame) => frame.slices.reduce((sum, slice) => sum + Math.abs(slice.offset), 0);
    const shaken = (frame: GlitchFrame) => Math.abs(frame.shake);
    const [first, last] = [ages[0]!, ages.at(-1)!];

    const strengths = [glitchFrame(first, 1)!.strength, glitchFrame(last, 1)!.strength];

    expect(strengths[1]).toBeLessThan(strengths[0]!);
    expect(total(last, torn)).toBeLessThan(total(first, torn));
    expect(total(last, shaken)).toBeLessThan(total(first, shaken));
  });

  it('keeps every slice within the figure and its tear within the strength', () => {
    const frames = [5, 6, 7].flatMap((seed) => ages.map((age) => glitchFrame(age, seed)!));

    const slices = frames.flatMap((frame) => frame.slices.map((slice) => ({ slice, strength: frame.strength })));

    expect(frames.every((frame) => frame.slices.length <= SLICES)).toBe(true);
    for (const { slice, strength } of slices) {
      expect(slice.y).toBeGreaterThan(0);
      expect(slice.y).toBeLessThan(1.2);
      expect(Math.abs(slice.offset)).toBeLessThanOrEqual(0.7 * strength);
    }
  });

  it('leaves no ghost at the portal it went into after the ghost time', () => {
    const later = ages.filter((age) => age >= GHOST_SECONDS);

    const ghosts = [1, 2, 3].flatMap((seed) => later.map((age) => glitchFrame(age, seed)!.ghost));

    expect(ghosts.every((ghost) => !ghost)).toBe(true);
  });
});

describe('glitchHash', () => {
  it('gives numbers in [0, 1) that differ between steps', () => {
    const rolls = Array.from({ length: 200 }, (_, step) => glitchHash(9, step, 1));

    expect(rolls.every((roll) => roll >= 0 && roll < 1)).toBe(true);
    expect(new Set(rolls).size).toBeGreaterThan(190);
  });
});
