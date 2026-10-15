import { CONSTANTS } from './params';
import { createRng } from './rng';
import type { Rng } from './rng';
import type { Counters, EmployerType, Mode, OutcomeCounts, Params, Posting, Seeker, SimState, Slot } from './types';

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Status-quo applications per week: 8 when applying is tailored (friction 1), 40 with Easy Apply (friction 0). */
export function statusQuoAppsPerWeek(friction: number): number {
  return Math.round(8 + 32 * (1 - friction));
}

export function weeklyApps(params: Params, mode: Mode): number {
  return mode === 'liveReq' ? params.tokens : statusQuoAppsPerWeek(params.friction);
}

/** Effort per application falls as weekly volume rises: 15/week → 0.63, 100/week → 0.2. */
export function effortFor(appsPerWeek: number): number {
  return 1 / (1 + appsPerWeek / 25);
}

export function emptyOutcomeCounts(): OutcomeCounts {
  return { advanced: 0, hired: 0, declined: 0, stamped: 0, ghosted: 0, withdrawn: 0 };
}

function emptyCounters(): Counters {
  return {
    applications: 0, hires: 0, advanced: 0, declined: 0, stamped: 0, ghosted: 0, withdrawn: 0,
    bondPaidIn: 0, payoutsGenuine: 0, payoutsFarmer: 0, refunds: 0, forfeits: 0,
    recruiterMinutes: 0, seekersEver: 0, seekersGhosted: 0,
  };
}

export function addSeeker(state: SimState, rng: Rng, budget: number): Seeker {
  const seeker: Seeker = {
    id: state.nextId.seeker++,
    type: rng.chance(state.params.farmerShare) ? 'farmer' : 'genuine',
    quality: clamp01(0.5 + 0.15 * rng.normal()),
    budget,
    payoutsThisWeek: 0,
    applied: new Set(),
    apps: [],
  };
  state.seekers.push(seeker);
  state.seekerById.set(seeker.id, seeker);
  state.counters.seekersEver++;
  return seeker;
}

export function openPosting(state: SimState, rng: Rng, slot: number, type: EmployerType, openedDay: number): Posting {
  const posting: Posting = {
    id: state.nextId.posting++,
    slot,
    type,
    openings: type === 'ghost' ? 0 : 1 + rng.int(3),
    filled: 0,
    bar: 0.7 + 0.15 * rng.next(),
    openedDay,
    accepting: true,
    retired: false,
    applicants: 0,
    bondRemaining: 0,
    pending: [],
    counts: emptyOutcomeCounts(),
    reasons: {},
    paid: 0,
  };
  if (state.mode === 'liveReq') {
    posting.bondRemaining = state.params.bond;
    state.counters.bondPaidIn += state.params.bond;
  }
  state.postings.push(posting);
  return posting;
}

/** Employer types assigned by exact quota, then shuffled. */
function slotTypes(params: Params, rng: Rng): EmployerType[] {
  const n = params.postings;
  const diligent = Math.round(params.diligentShare * n);
  const ghost = Math.min(n - diligent, Math.round(params.ghostShare * n));
  const types: EmployerType[] = [];
  for (let i = 0; i < n; i++) types.push(i < diligent ? 'diligent' : i < diligent + ghost ? 'ghost' : 'rational');
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

/**
 * The initial population uses its own random stream, so both modes start from
 * the same seekers and employers for a given seed.
 */
export function createState(params: Params, seed: number, mode: Mode): SimState {
  const pop = createRng(seed, 1);
  const state: SimState = {
    day: 0,
    mode,
    params,
    rng: createRng(seed, 2),
    seekers: [],
    seekerById: new Map(),
    ghostedSeekerIds: new Set(),
    slots: [],
    postings: [],
    applications: [],
    counters: emptyCounters(),
    nextId: { seeker: 0, posting: 0, application: 0 },
  };
  const types = slotTypes(params, pop);
  types.forEach((type, slot) => {
    // Stagger ages so postings don't all close on the same day.
    const age = pop.int(CONSTANTS.postingLifetimeDays);
    const current = openPosting(state, pop, slot, type, -age);
    const s: Slot = { type, current, history: [], badge: false, ghostedTotal: 0, respondedTotal: 0 };
    state.slots.push(s);
  });
  for (let i = 0; i < params.seekers; i++) addSeeker(state, pop, weeklyApps(params, mode));
  return state;
}
