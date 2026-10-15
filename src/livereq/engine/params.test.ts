import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, PRESETS, clampParams, decodeHash, encodeHash } from './params';

describe('clampParams', () => {
  it('fills missing values from the defaults', () => {
    expect(clampParams({})).toEqual(DEFAULT_PARAMS);
  });

  it('clamps out-of-range values and rounds integer fields', () => {
    const p = clampParams({ bond: -50, tokens: 3.6, friction: 7, cap: 1 });
    expect(p.bond).toBe(0);
    expect(p.tokens).toBe(4);
    expect(p.friction).toBe(1);
    expect(p.cap).toBe(10);
  });

  it('replaces NaN and Infinity with the default', () => {
    const p = clampParams({ bond: Number.NaN, deadline: Number.POSITIVE_INFINITY });
    expect(p.bond).toBe(DEFAULT_PARAMS.bond);
    expect(p.deadline).toBe(DEFAULT_PARAMS.deadline);
  });

  it('caps the hidden scale settings so a hand-edited link cannot freeze the page', () => {
    const p = clampParams({ seekers: 5000, postings: 500, days: 400 });
    expect(p.seekers).toBe(1000);
    expect(p.postings).toBe(100);
    expect(p.days).toBe(126);
  });

  it('scales employer shares down when they sum to more than 1', () => {
    const p = clampParams({ diligentShare: 0.9, ghostShare: 0.6 });
    expect(p.diligentShare + p.ghostShare).toBeCloseTo(1);
    expect(p.diligentShare / p.ghostShare).toBeCloseTo(1.5);
  });
});

describe('hash encoding', () => {
  it('round-trips params, seed and view', () => {
    const state = { params: clampParams({ bond: 1234, audits: true, friction: 0.25 }), seed: 99, view: 'liveReq' as const };
    expect(decodeHash(encodeHash(state))).toEqual({ state, ok: true });
  });

  it('treats an empty hash as the defaults without a warning', () => {
    const { state, ok } = decodeHash('');
    expect(ok).toBe(true);
    expect(state.params).toEqual(DEFAULT_PARAMS);
  });

  it.each([
    ['wrong version', '#v=0&seed=1&view=liveReq'],
    ['garbage', '#%%%not-a-hash'],
    ['bad number', '#v=1&seed=1&view=liveReq&bond=abc'],
    ['bad boolean', '#v=1&seed=1&view=liveReq&audits=yes'],
    ['bad view', '#v=1&seed=1&view=split'],
    ['negative seed', '#v=1&seed=-3&view=liveReq'],
  ])('falls back to defaults with ok=false on %s', (_label, hash) => {
    const { state, ok } = decodeHash(hash);
    expect(ok).toBe(false);
    expect(state.params).toEqual(DEFAULT_PARAMS);
  });

  it('clamps out-of-range values from a hand-edited hash instead of rejecting it', () => {
    const { state, ok } = decodeHash('#v=1&seed=1&view=liveReq&bond=999999');
    expect(ok).toBe(true);
    expect(state.params.bond).toBe(20000);
  });
});

describe('PRESETS', () => {
  it('has unique ids and valid params', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const preset of PRESETS) expect(clampParams(preset.params)).toEqual(preset.params);
  });
});
