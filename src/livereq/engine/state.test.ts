import { describe, expect, it } from 'vitest';
import { clampParams } from './params';
import { createState, effortFor, statusQuoAppsPerWeek } from './state';

describe('volume and effort', () => {
  it('maps friction to weekly applications', () => {
    expect(statusQuoAppsPerWeek(1)).toBe(8);
    expect(statusQuoAppsPerWeek(0)).toBe(40);
    expect(statusQuoAppsPerWeek(0.6)).toBe(21);
  });

  it('lowers effort as volume rises', () => {
    expect(effortFor(15)).toBeCloseTo(0.625);
    expect(effortFor(100)).toBeCloseTo(0.2);
  });
});

describe('createState', () => {
  it('assigns employer types by exact quota', () => {
    const state = createState(clampParams({ postings: 40, diligentShare: 0.25, ghostShare: 0.15 }), 1, 'statusQuo');
    const count = (t: string) => state.slots.filter((s) => s.type === t).length;
    expect(count('diligent')).toBe(10);
    expect(count('ghost')).toBe(6);
    expect(count('rational')).toBe(24);
  });

  it('starts both modes from the same population for a seed', () => {
    const params = clampParams({ farmerShare: 0.2 });
    const a = createState(params, 5, 'statusQuo');
    const b = createState(params, 5, 'liveReq');
    expect(b.seekers.map((s) => [s.quality, s.type])).toEqual(a.seekers.map((s) => [s.quality, s.type]));
    expect(b.slots.map((s) => [s.type, s.current.openings, s.current.bar])).toEqual(
      a.slots.map((s) => [s.type, s.current.openings, s.current.bar]),
    );
  });

  it('pays one bond per opening posting only in LiveReq', () => {
    const params = clampParams({ postings: 10, bond: 500 });
    expect(createState(params, 1, 'liveReq').counters.bondPaidIn).toBe(5000);
    expect(createState(params, 1, 'statusQuo').counters.bondPaidIn).toBe(0);
  });

  it('gives ghost employers no openings', () => {
    const state = createState(clampParams({ ghostShare: 1, diligentShare: 0 }), 1, 'liveReq');
    expect(state.slots.every((s) => s.current.openings === 0)).toBe(true);
  });
});
