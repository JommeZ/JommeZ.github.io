import { CONSTANTS } from './params';
import { clamp01, effortFor, weeklyApps } from './state';
import type { Application, Posting, Seeker, SimState } from './types';

function score(state: SimState, seeker: Seeker, posting: Posting, fit: number): number {
  const { params, mode, rng } = state;
  const slot = state.slots[posting.slot];
  if (mode === 'liveReq' && seeker.type === 'farmer') {
    if (params.history) return (slot.badge ? 0 : 1) + 0.1 * rng.next();
    // Word of mouth: the employer's all-time ghosting rate (Laplace-smoothed).
    const ghostRate = (slot.ghostedTotal + 1) / (slot.ghostedTotal + slot.respondedTotal + 2);
    return ghostRate + 0.1 * rng.next();
  }
  return fit + (params.history && slot.badge ? CONSTANTS.badgePreference : 0);
}

/** Look at a random sample of open postings and pick the best by the seeker's own scoring. */
function choose(state: SimState, seeker: Seeker, open: Posting[]): { posting: Posting; fit: number } | null {
  const { rng } = state;
  let best: { posting: Posting; fit: number; score: number } | null = null;
  for (let i = 0; i < CONSTANTS.sampleSize; i++) {
    const posting = open[rng.int(open.length)];
    if (!posting.accepting || seeker.applied.has(posting.id)) continue;
    const fit = clamp01(seeker.quality + 0.15 * rng.normal());
    const s = score(state, seeker, posting, fit);
    if (!best || s > best.score) best = { posting, fit, score: s };
  }
  return best;
}

function submit(state: SimState, seeker: Seeker, posting: Posting, fit: number): void {
  const { params, mode, rng } = state;
  const effort = effortFor(weeklyApps(params, mode));
  const app: Application = {
    id: state.nextId.application++,
    seekerId: seeker.id,
    seekerType: seeker.type,
    postingId: posting.id,
    day: state.day,
    fit,
    signal: fit + rng.normal() * (0.05 + 0.35 * (1 - effort)),
    state: 'pending',
    payout: 0,
  };
  state.applications.push(app);
  seeker.apps.push(app);
  seeker.applied.add(posting.id);
  seeker.budget--;
  posting.pending.push(app);
  posting.applicants++;
  state.counters.applications++;
  if (mode === 'liveReq' && posting.applicants >= params.cap) posting.accepting = false;
}

/** Each seeker spreads what is left of this week's budget over the remaining days. */
export function applyPhase(state: SimState): void {
  const { rng } = state;
  const open = state.slots.map((s) => s.current).filter((p) => p.accepting);
  if (open.length === 0) return;
  const daysLeft = 7 - (state.day % 7);
  for (const seeker of state.seekers) {
    const share = seeker.budget / daysLeft;
    const count = Math.min(seeker.budget, Math.floor(share) + (rng.chance(share - Math.floor(share)) ? 1 : 0));
    for (let i = 0; i < count; i++) {
      const pick = choose(state, seeker, open);
      if (!pick) break;
      submit(state, seeker, pick.posting, pick.fit);
    }
  }
}
