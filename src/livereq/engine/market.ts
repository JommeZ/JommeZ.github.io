import { reviewPhase } from './employers';
import { CONSTANTS } from './params';
import { applyPhase } from './seekers';
import { addSeeker, openPosting, weeklyApps } from './state';
import type { Application, Posting, SimState } from './types';

function refillPhase(state: SimState): void {
  if (state.day % 7 !== 0) return;
  const budget = weeklyApps(state.params, state.mode);
  for (const seeker of state.seekers) {
    seeker.budget = budget;
    seeker.payoutsThisWeek = 0;
  }
}

function postingById(state: SimState, id: number): Posting {
  return state.postings[id];
}

function payout(state: SimState, posting: Posting, app: Application): void {
  const { params, counters } = state;
  const seeker = state.seekerById.get(app.seekerId);
  if (!seeker) return;
  if (params.payoutCap && seeker.payoutsThisWeek >= params.payoutCapPerWeek) return;
  const amount = Math.min(params.bond / params.cap, posting.bondRemaining);
  if (amount <= 0) return;
  posting.bondRemaining -= amount;
  app.payout = amount;
  posting.paid++;
  seeker.payoutsThisWeek++;
  if (app.seekerType === 'farmer') counters.payoutsFarmer += amount;
  else counters.payoutsGenuine += amount;
}

function deadlinePhase(state: SimState): void {
  const { counters, mode, params } = state;
  const deadline = mode === 'liveReq' ? params.deadline : CONSTANTS.statusQuoGhostDays;
  for (const posting of state.postings) {
    if (posting.retired) continue;
    for (const app of posting.pending) {
      if (app.state !== 'pending' || state.day - app.day < deadline) continue;
      app.state = 'ghosted';
      counters.ghosted++;
      posting.counts.ghosted++;
      const slot = state.slots[posting.slot];
      slot.history.push({ day: state.day, responded: false });
      slot.ghostedTotal++;
      if (!state.ghostedSeekerIds.has(app.seekerId)) {
        state.ghostedSeekerIds.add(app.seekerId);
        counters.seekersGhosted++;
      }
      if (mode === 'liveReq') payout(state, posting, app);
    }
    posting.pending = posting.pending.filter((a) => a.state === 'pending');
  }
}

/** An audit that catches a stamped decline of a candidate above the bar forfeits the remaining bond. */
function auditPhase(state: SimState, declines: Application[]): void {
  const { params, mode, rng, counters } = state;
  if (mode !== 'liveReq' || !params.audits) return;
  for (const app of declines) {
    if (!rng.chance(params.auditRate)) continue;
    const posting = postingById(state, app.postingId);
    if (app.state === 'stamped' && app.fit >= posting.bar && posting.bondRemaining > 0) {
      const amount = posting.bondRemaining;
      counters.forfeits += amount;
      posting.bondRemaining = 0;
      // The forfeit is shared among everyone this posting rubber-stamped so far.
      const stamped = state.applications.filter((a) => a.postingId === posting.id && a.state === 'stamped');
      for (const victim of stamped) victim.payout += amount / stamped.length;
    }
  }
}

function hirePhase(state: SimState, advanced: Application[]): void {
  const { rng, counters } = state;
  for (const app of advanced) {
    const posting = postingById(state, app.postingId);
    const seeker = state.seekerById.get(app.seekerId);
    if (!seeker || posting.filled >= posting.openings || !rng.chance(CONSTANTS.offerRate)) continue;
    app.state = 'hired';
    counters.hires++;
    posting.filled++;
    posting.counts.hired++;
    if (posting.filled >= posting.openings) posting.accepting = false;
    // The hired seeker withdraws everywhere else and is replaced by a newcomer.
    for (const other of seeker.apps) {
      if (other.state !== 'pending') continue;
      other.state = 'withdrawn';
      other.reason = 'withdrew';
      counters.withdrawn++;
      postingById(state, other.postingId).counts.withdrawn++;
    }
    state.seekers.splice(state.seekers.indexOf(seeker), 1);
    state.seekerById.delete(seeker.id);
    const daysLeft = 7 - (state.day % 7);
    addSeeker(state, rng, Math.round((weeklyApps(state.params, state.mode) * (daysLeft - 1)) / 7));
  }
}

function lifecyclePhase(state: SimState): void {
  for (const slot of state.slots) {
    // A slot posts a new role only once the current posting's cycle has ended,
    // even if it filled early, so hiring capacity stays bounded.
    const p = slot.current;
    if (state.day - p.openedDay < CONSTANTS.postingLifetimeDays) continue;
    p.accepting = false;
    slot.current = openPosting(state, state.rng, p.slot, slot.type, state.day);
  }
  for (const posting of state.postings) {
    if (posting.retired || posting.accepting) continue;
    posting.pending = posting.pending.filter((a) => a.state === 'pending');
    if (posting.pending.length > 0) continue;
    posting.retired = true;
    state.counters.refunds += posting.bondRemaining;
    posting.bondRemaining = 0;
  }
}

function badgePhase(state: SimState): void {
  if (state.day % 7 !== 6) return;
  const from = state.day - CONSTANTS.historyWindowDays;
  for (const slot of state.slots) {
    slot.history = slot.history.filter((e) => e.day > from);
    const responded = slot.history.filter((e) => e.responded).length;
    slot.badge = slot.history.length > 0 && responded / slot.history.length > CONSTANTS.badgeThreshold;
  }
}

/** Advance one day. Order follows the spec (section 6). */
export function step(state: SimState): void {
  refillPhase(state);
  applyPhase(state);
  const { declines, advanced } = reviewPhase(state);
  deadlinePhase(state);
  auditPhase(state, declines);
  hirePhase(state, advanced);
  lifecyclePhase(state);
  badgePhase(state);
}
