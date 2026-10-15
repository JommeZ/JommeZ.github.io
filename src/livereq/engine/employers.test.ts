import { describe, expect, it } from 'vitest';
import { actionCosts, cheapest } from './employers';
import { clampParams } from './params';
import { createState } from './state';

describe('actionCosts', () => {
  it('prices review, stamp and ghost for LiveReq without audits', () => {
    const state = createState(clampParams({ bond: 2000, cap: 100, hourlyCost: 60, triageMinutes: 1, fullReadMinutes: 15 }), 1, 'liveReq');
    expect(actionCosts(state)).toEqual({ review: 16, stamp: 1, ghost: 20 });
  });

  it('adds the expected forfeit to stamping when audits are on', () => {
    const state = createState(clampParams({ bond: 2000, hourlyCost: 60, audits: true, auditRate: 0.2 }), 1, 'liveReq');
    expect(actionCosts(state).stamp).toBeCloseTo(401);
  });

  it('makes ghosting free in the status quo', () => {
    const state = createState(clampParams({}), 1, 'statusQuo');
    expect(actionCosts(state).ghost).toBe(0);
  });
});

describe('cheapest', () => {
  it('picks the lowest cost, preferring review then stamp on ties', () => {
    expect(cheapest({ review: 16, stamp: 1, ghost: 20 })).toBe('stamp');
    expect(cheapest({ review: 16, stamp: 401, ghost: 20 })).toBe('review');
    expect(cheapest({ review: 16, stamp: 401, ghost: 10 })).toBe('ghost');
    expect(cheapest({ review: 5, stamp: 5, ghost: 5 })).toBe('review');
    expect(cheapest({ review: 9, stamp: 5, ghost: 5 })).toBe('stamp');
  });
});
