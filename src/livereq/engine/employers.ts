import { CONSTANTS } from './params';
import type { Application, Posting, ReasonCode, SimState } from './types';

export type Action = 'review' | 'stamp' | 'ghost';

export interface ActionCosts {
  review: number;
  stamp: number;
  ghost: number;
}

/** Dollar cost to the employer of each way of handling one applicant it does not need. */
export function actionCosts(state: SimState): ActionCosts {
  const { params, mode } = state;
  const perMinute = params.hourlyCost / 60;
  const liveReq = mode === 'liveReq';
  return {
    review: (params.triageMinutes + params.fullReadMinutes) * perMinute,
    stamp: params.triageMinutes * perMinute + (liveReq && params.audits ? params.auditRate * params.bond : 0),
    ghost: liveReq ? params.bond / params.cap : 0,
  };
}

/** Cheapest action; ties prefer review, then stamp. */
export function cheapest(costs: ActionCosts): Action {
  if (costs.review <= costs.stamp && costs.review <= costs.ghost) return 'review';
  return costs.stamp <= costs.ghost ? 'stamp' : 'ghost';
}

export function chooseAction(state: SimState, posting: Posting): Action {
  if (posting.type === 'diligent') return 'review';
  if (posting.type === 'rational' && posting.filled < posting.openings) return 'review';
  return cheapest(actionCosts(state));
}

export interface ReviewOutcome {
  declines: Application[];
  advanced: Application[];
}

function respond(state: SimState, posting: Posting, app: Application, next: Application['state'], reason?: ReasonCode): void {
  app.state = next;
  if (reason) {
    app.reason = reason;
    posting.reasons[reason] = (posting.reasons[reason] ?? 0) + 1;
  }
  const slot = state.slots[posting.slot];
  slot.history.push({ day: state.day, responded: true });
  slot.respondedTotal++;
}

/** Each posting spends its daily recruiter minutes on pending applicants, oldest first. */
export function reviewPhase(state: SimState): ReviewOutcome {
  const { params, counters } = state;
  const out: ReviewOutcome = { declines: [], advanced: [] };
  const triage = params.triageMinutes;
  const full = params.fullReadMinutes;
  for (const posting of state.postings) {
    if (posting.retired) continue;
    let minutes = params.recruiterMinutesPerDay;
    for (const app of posting.pending) {
      if (app.state !== 'pending') continue;
      const action = chooseAction(state, posting);
      if (action === 'ghost') continue;
      if (action === 'stamp') {
        if (minutes < triage) break;
        minutes -= triage;
        counters.recruiterMinutes += triage;
        respond(state, posting, app, 'stamped', 'lacks_skills');
        counters.stamped++;
        posting.counts.stamped++;
        out.declines.push(app);
        continue;
      }
      if (minutes < triage + full) break;
      minutes -= triage;
      counters.recruiterMinutes += triage;
      if (app.signal < posting.bar - CONSTANTS.triageSlack) {
        respond(state, posting, app, 'declined', 'not_a_fit');
      } else {
        minutes -= full;
        counters.recruiterMinutes += full;
        if (app.fit < posting.bar) {
          respond(state, posting, app, 'declined', 'lacks_skills');
        } else if (posting.filled >= posting.openings) {
          respond(state, posting, app, 'declined', 'preferred_another');
        } else {
          respond(state, posting, app, 'advanced');
          counters.advanced++;
          posting.counts.advanced++;
          out.advanced.push(app);
          continue;
        }
      }
      counters.declined++;
      posting.counts.declined++;
      out.declines.push(app);
    }
    posting.pending = posting.pending.filter((a) => a.state === 'pending');
  }
  return out;
}
