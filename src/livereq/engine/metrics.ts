import type { PostingView, SimState, Snapshot } from './types';

export function snapshot(state: SimState): Snapshot {
  const c = state.counters;
  const firstOutcomes = c.advanced + c.declined + c.stamped + c.ghosted;
  const declines = c.declined + c.stamped;
  const postings: PostingView[] = state.slots.map((slot) => ({
    slot: slot.current.slot,
    type: slot.type,
    badge: slot.badge,
    accepting: slot.current.accepting,
    pending: slot.current.pending.filter((a) => a.state === 'pending').length,
    paid: slot.current.paid,
    counts: { ...slot.current.counts },
    reasons: { ...slot.current.reasons },
  }));
  return {
    day: state.day,
    counters: { ...c },
    appsPerHire: c.hires > 0 ? c.applications / c.hires : null,
    ghostedShare: firstOutcomes > 0 ? c.ghosted / firstOutcomes : 0,
    stampedShare: declines > 0 ? c.stamped / declines : 0,
    interviewRate: c.applications > 0 ? c.advanced / c.applications : 0,
    seekersGhostedShare: c.seekersEver > 0 ? c.seekersGhosted / c.seekersEver : 0,
    recruiterHours: c.recruiterMinutes / 60,
    postings,
  };
}
