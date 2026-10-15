import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

const draw = (seed: number, stream = 0, n = 5) => {
  const r = createRng(seed, stream);
  return Array.from({ length: n }, () => r.next());
};

describe('createRng', () => {
  it('repeats the same sequence for the same seed and stream', () => {
    expect(draw(42)).toEqual(draw(42));
  });

  it('gives different sequences for different seeds or streams', () => {
    expect(draw(42)).not.toEqual(draw(43));
    expect(draw(42, 1)).not.toEqual(draw(42, 2));
  });

  it('stays within [0, 1) and int(n) within [0, n)', () => {
    const r = createRng(7);
    const xs = Array.from({ length: 10_000 }, () => r.next());
    const ks = new Set(Array.from({ length: 1_000 }, () => r.int(3)));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect([...ks].sort()).toEqual([0, 1, 2]);
  });

  it('produces normals with mean ~0 and sd ~1', () => {
    const r = createRng(9);
    const xs = Array.from({ length: 20_000 }, () => r.normal());
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
});
