import type { Rng } from './rng';

export type Mode = 'statusQuo' | 'liveReq';
export type ViewMode = Mode | 'sideBySide';
export type EmployerType = 'diligent' | 'rational' | 'ghost';
export type SeekerType = 'genuine' | 'farmer';
/** Subset of Greenhouse's default rejection reasons that the sim can produce. */
export type ReasonCode = 'not_a_fit' | 'lacks_skills' | 'preferred_another' | 'withdrew';
export type AppState = 'pending' | 'advanced' | 'hired' | 'declined' | 'stamped' | 'ghosted' | 'withdrawn';

export interface Params {
  days: number;
  seekers: number;
  postings: number;
  bond: number;
  cap: number;
  deadline: number;
  tokens: number;
  friction: number;
  triageMinutes: number;
  fullReadMinutes: number;
  recruiterMinutesPerDay: number;
  hourlyCost: number;
  diligentShare: number;
  ghostShare: number;
  farmerShare: number;
  audits: boolean;
  auditRate: number;
  payoutCap: boolean;
  payoutCapPerWeek: number;
  history: boolean;
  postingFee: number;
}

export interface Application {
  id: number;
  seekerId: number;
  seekerType: SeekerType;
  postingId: number;
  day: number;
  /** True fit, revealed by a full read. */
  fit: number;
  /** What triage sees: fit plus noise that grows as effort falls. */
  signal: number;
  state: AppState;
  reason?: ReasonCode;
  /** Bond money this applicant received when ghosted under LiveReq. */
  payout: number;
}

export interface Seeker {
  id: number;
  type: SeekerType;
  quality: number;
  budget: number;
  payoutsThisWeek: number;
  applied: Set<number>;
  apps: Application[];
}

export type OutcomeCounts = Record<'advanced' | 'hired' | 'declined' | 'stamped' | 'ghosted' | 'withdrawn', number>;

export interface Posting {
  id: number;
  slot: number;
  type: EmployerType;
  openings: number;
  filled: number;
  bar: number;
  openedDay: number;
  accepting: boolean;
  retired: boolean;
  applicants: number;
  bondRemaining: number;
  pending: Application[];
  counts: OutcomeCounts;
  reasons: Partial<Record<ReasonCode, number>>;
  /** Ghosted applicants who received a payout. */
  paid: number;
}

export interface Slot {
  type: EmployerType;
  current: Posting;
  /** Response events in the rolling history window: true = got a status, false = ghosted. */
  history: { day: number; responded: boolean }[];
  badge: boolean;
  ghostedTotal: number;
  respondedTotal: number;
}

export interface Counters {
  applications: number;
  hires: number;
  advanced: number;
  declined: number;
  stamped: number;
  ghosted: number;
  withdrawn: number;
  bondPaidIn: number;
  payoutsGenuine: number;
  payoutsFarmer: number;
  refunds: number;
  forfeits: number;
  recruiterMinutes: number;
  seekersEver: number;
  seekersGhosted: number;
}

export interface SimState {
  day: number;
  mode: Mode;
  params: Params;
  rng: Rng;
  seekers: Seeker[];
  seekerById: Map<number, Seeker>;
  ghostedSeekerIds: Set<number>;
  slots: Slot[];
  postings: Posting[];
  applications: Application[];
  counters: Counters;
  nextId: { seeker: number; posting: number; application: number };
}

export interface PostingView {
  slot: number;
  type: EmployerType;
  badge: boolean;
  accepting: boolean;
  pending: number;
  paid: number;
  counts: OutcomeCounts;
  reasons: Partial<Record<ReasonCode, number>>;
}

export interface Snapshot {
  day: number;
  counters: Counters;
  appsPerHire: number | null;
  ghostedShare: number;
  stampedShare: number;
  interviewRate: number;
  seekersGhostedShare: number;
  recruiterHours: number;
  postings: PostingView[];
}
