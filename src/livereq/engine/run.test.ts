import { describe, expect, it } from 'vitest';
import { PRESETS, clampParams } from './params';
import { runSimulation, simulate } from './run';
import type { Mode, Params, Snapshot } from './types';

const SEEDS = [1, 2, 3, 4, 5];
const preset = (id: string): Params => PRESETS.find((p) => p.id === id)!.params;

function avg(params: Params, mode: Mode, pick: (s: Snapshot) => number): number {
  const values = SEEDS.map((seed) => pick(runSimulation(params, seed, mode).at(-1)!));
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe('determinism', () => {
  it('gives identical snapshots for the same params and seed', () => {
    const params = preset('countermeasures');
    expect(runSimulation(params, 3, 'liveReq')).toEqual(runSimulation(params, 3, 'liveReq'));
  });

  it('returns one snapshot per day', () => {
    const snaps = runSimulation(clampParams({ days: 21 }), 1, 'statusQuo');
    expect(snaps.map((s) => s.day)).toEqual(Array.from({ length: 21 }, (_, i) => i));
  });
});

describe('invariants', () => {
  for (const mode of ['statusQuo', 'liveReq'] as Mode[]) {
    for (const p of PRESETS) {
      it(`${p.id} / ${mode}: every application has exactly one state and counters match`, () => {
        const { state } = simulate(p.params, 1, mode);
        const byState: Record<string, number> = {};
        for (const app of state.applications) byState[app.state] = (byState[app.state] ?? 0) + 1;
        const c = state.counters;
        expect(state.applications.length).toBe(c.applications);
        expect(byState.hired ?? 0).toBe(c.hires);
        expect((byState.advanced ?? 0) + (byState.hired ?? 0)).toBe(c.advanced);
        expect(byState.declined ?? 0).toBe(c.declined);
        expect(byState.stamped ?? 0).toBe(c.stamped);
        expect(byState.ghosted ?? 0).toBe(c.ghosted);
        expect(byState.withdrawn ?? 0).toBe(c.withdrawn);
      });

      it(`${p.id} / ${mode}: bond money adds up`, () => {
        const { state } = simulate(p.params, 1, mode);
        const c = state.counters;
        const held = state.postings.reduce((sum, posting) => sum + posting.bondRemaining, 0);
        expect(c.payoutsGenuine + c.payoutsFarmer + c.refunds + c.forfeits + held).toBeCloseTo(c.bondPaidIn, 6);
        for (const posting of state.postings) expect(posting.bondRemaining).toBeGreaterThanOrEqual(0);
      });
    }
  }

  it('never lets a LiveReq seeker apply more than T times in a week', () => {
    const params = clampParams({ tokens: 3 });
    const { state } = simulate(params, 1, 'liveReq');
    const perSeekerWeek = new Map<string, number>();
    for (const app of state.applications) {
      const key = `${app.seekerId}:${Math.floor(app.day / 7)}`;
      perSeekerWeek.set(key, (perSeekerWeek.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perSeekerWeek.values())).toBeLessThanOrEqual(3);
  });

  it('never pays a seeker more than the payout cap in a week', () => {
    const params = preset('countermeasures');
    const { state } = simulate(params, 1, 'liveReq');
    const paid = state.applications.filter((a) => a.payout > 0);
    expect(paid.length).toBeGreaterThan(0);
    const perSeekerWeek = new Map<string, number>();
    for (const app of paid) {
      // Payouts happen on the deadline day, so bucket by the day the payout was made.
      const key = `${app.seekerId}:${Math.floor((app.day + params.deadline) / 7)}`;
      perSeekerWeek.set(key, (perSeekerWeek.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perSeekerWeek.values())).toBeLessThanOrEqual(params.payoutCapPerWeek);
  });
});

describe('edge settings', () => {
  it.each(['statusQuo', 'liveReq'] as Mode[])('%s: extreme sliders give finite metrics and no hires-based NaN', (mode) => {
    const params = clampParams({ bond: 0, tokens: 1, cap: 10, deadline: 1, ghostShare: 1, diligentShare: 0, days: 7, friction: 0 });
    const snaps = runSimulation(params, 1, mode);
    for (const s of snaps) {
      expect(s.counters.hires).toBe(0);
      expect(s.appsPerHire).toBeNull();
      for (const v of [s.ghostedShare, s.stampedShare, s.interviewRate, s.seekersGhostedShare, s.recruiterHours]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe('direction of effects (averaged over 5 seeds)', () => {
  it('a bond above the review cost removes ghosting when audits are on', () => {
    const low = avg(clampParams({ audits: true, bond: 500 }), 'liveReq', (s) => s.ghostedShare);
    const high = avg(clampParams({ audits: true, bond: 2000 }), 'liveReq', (s) => s.ghostedShare);
    expect(high).toBeLessThan(low);
    expect(high).toBe(0);
  });

  it('fewer tokens means fewer applications per hire', () => {
    const few = avg(clampParams({ tokens: 2 }), 'liveReq', (s) => s.appsPerHire ?? Infinity);
    const many = avg(clampParams({ tokens: 20 }), 'liveReq', (s) => s.appsPerHire ?? Infinity);
    expect(few).toBeLessThan(many);
  });

  it('audits remove rubber-stamping', () => {
    const off = avg(preset('basic'), 'liveReq', (s) => s.stampedShare);
    const on = avg(preset('audits'), 'liveReq', (s) => s.stampedShare);
    expect(off).toBeGreaterThan(0.1);
    expect(on).toBeLessThan(off);
  });

  it('farmers collect payouts on a cheap bond, and the payout cap reduces it', () => {
    const attack = avg(preset('farmers'), 'liveReq', (s) => s.counters.payoutsFarmer);
    const capped = avg(clampParams({ ...preset('farmers'), payoutCap: true }), 'liveReq', (s) => s.counters.payoutsFarmer);
    expect(attack).toBeGreaterThan(0);
    expect(capped).toBeLessThan(attack);
  });

  it('more application friction raises the status-quo interview rate', () => {
    const easy = avg(clampParams({ friction: 0 }), 'statusQuo', (s) => s.interviewRate);
    const tailored = avg(clampParams({ friction: 1 }), 'statusQuo', (s) => s.interviewRate);
    expect(tailored).toBeGreaterThan(easy);
  });
});

describe("calibration: Today's job market", () => {
  const today = preset('today');
  it('lands near real-world figures', () => {
    const finals = SEEDS.map((seed) => runSimulation(today, seed, 'statusQuo').at(-1)!);
    const mean = (pick: (s: Snapshot) => number) => finals.reduce((sum, s) => sum + pick(s), 0) / finals.length;
    const appsPerHire = mean((s) => s.appsPerHire ?? 0);
    const interviewRate = mean((s) => s.interviewRate);
    const seekersGhosted = mean((s) => s.seekersGhostedShare);
    expect(appsPerHire).toBeGreaterThan(200);
    expect(appsPerHire).toBeLessThan(400);
    expect(interviewRate).toBeGreaterThan(0.025);
    expect(interviewRate).toBeLessThan(0.095);
    expect(seekersGhosted).toBeGreaterThan(0.4);
    expect(seekersGhosted).toBeLessThan(0.8);
  });
});

describe('performance', () => {
  it('runs a side-by-side pair in well under a second', () => {
    const t = performance.now();
    runSimulation(preset('today'), 1, 'statusQuo');
    runSimulation(preset('today'), 1, 'liveReq');
    expect(performance.now() - t).toBeLessThan(1000);
  });
});
