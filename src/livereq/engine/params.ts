import type { Params, ViewMode } from './types';

/** Fixed model constants that are not exposed as controls. */
export const CONSTANTS = {
  postingLifetimeDays: 28,
  statusQuoGhostDays: 30,
  offerRate: 0.15,
  sampleSize: 8,
  historyWindowDays: 30,
  badgeThreshold: 0.51,
  triageSlack: 0.05,
  badgePreference: 0.1,
} as const;

export const DEFAULT_PARAMS: Params = {
  days: 84,
  seekers: 500,
  postings: 40,
  bond: 2000,
  cap: 100,
  deadline: 7,
  tokens: 5,
  friction: 0.6,
  triageMinutes: 1,
  fullReadMinutes: 15,
  recruiterMinutesPerDay: 240,
  hourlyCost: 50,
  diligentShare: 0.3,
  ghostShare: 0.15,
  farmerShare: 0,
  audits: false,
  auditRate: 0.2,
  payoutCap: false,
  payoutCapPerWeek: 1,
  history: false,
  postingFee: 299,
};

type NumericKey = { [K in keyof Params]: Params[K] extends number ? K : never }[keyof Params];
type BooleanKey = { [K in keyof Params]: Params[K] extends boolean ? K : never }[keyof Params];

/** [min, max, integer] */
export const RANGES: Record<NumericKey, [number, number, boolean]> = {
  days: [7, 182, true],
  seekers: [50, 2000, true],
  postings: [5, 200, true],
  bond: [0, 20000, false],
  cap: [10, 500, true],
  deadline: [1, 30, true],
  tokens: [1, 50, true],
  friction: [0, 1, false],
  triageMinutes: [0.1, 10, false],
  fullReadMinutes: [1, 60, false],
  recruiterMinutesPerDay: [30, 960, true],
  hourlyCost: [10, 300, false],
  diligentShare: [0, 1, false],
  ghostShare: [0, 1, false],
  farmerShare: [0, 1, false],
  auditRate: [0, 1, false],
  payoutCapPerWeek: [0, 50, true],
  postingFee: [0, 2000, false],
};

export const BOOLEAN_KEYS: BooleanKey[] = ['audits', 'payoutCap', 'history'];
export const NUMERIC_KEYS = Object.keys(RANGES) as NumericKey[];

function clampValue(key: NumericKey, value: number): number {
  const [min, max, integer] = RANGES[key];
  const v = Number.isFinite(value) ? value : DEFAULT_PARAMS[key];
  const clamped = Math.min(max, Math.max(min, v));
  return integer ? Math.round(clamped) : clamped;
}

/** Clamp every value into range and keep employer shares summing to at most 1. */
export function clampParams(input: Partial<Params>): Params {
  const out: Params = { ...DEFAULT_PARAMS };
  for (const key of NUMERIC_KEYS) {
    const v = input[key];
    if (typeof v === 'number') out[key] = clampValue(key, v);
  }
  for (const key of BOOLEAN_KEYS) {
    const v = input[key];
    if (typeof v === 'boolean') out[key] = v;
  }
  const shares = out.diligentShare + out.ghostShare;
  if (shares > 1) {
    out.diligentShare /= shares;
    out.ghostShare /= shares;
  }
  return out;
}

export interface Preset {
  id: string;
  label: string;
  view: ViewMode;
  params: Params;
}

const FARMERS: Partial<Params> = { audits: true, bond: 1000, farmerShare: 0.2, diligentShare: 0.1 };

export const PRESETS: Preset[] = [
  { id: 'today', label: "Today's job market", view: 'statusQuo', params: clampParams({}) },
  { id: 'basic', label: 'LiveReq basic', view: 'sideBySide', params: clampParams({}) },
  { id: 'audits', label: 'Audits on', view: 'liveReq', params: clampParams({ audits: true }) },
  { id: 'farmers', label: 'Farmers attack (cheap bond)', view: 'liveReq', params: clampParams(FARMERS) },
  {
    id: 'countermeasures',
    label: 'Countermeasures',
    view: 'liveReq',
    params: clampParams({ ...FARMERS, payoutCap: true, history: true }),
  },
];

export interface HashState {
  params: Params;
  seed: number;
  view: ViewMode;
}

export const HASH_VERSION = '1';
const VIEWS: ViewMode[] = ['statusQuo', 'liveReq', 'sideBySide'];

export function encodeHash(state: HashState): string {
  const q = new URLSearchParams();
  q.set('v', HASH_VERSION);
  q.set('seed', String(state.seed));
  q.set('view', state.view);
  for (const key of NUMERIC_KEYS) q.set(key, String(state.params[key]));
  for (const key of BOOLEAN_KEYS) q.set(key, state.params[key] ? '1' : '0');
  return '#' + q.toString();
}

export const DEFAULT_HASH_STATE: HashState = { params: DEFAULT_PARAMS, seed: 1, view: 'sideBySide' };

/**
 * Parse a location hash. An empty hash gives the defaults with ok=true.
 * A hash from another version, or with any unparsable value, gives the defaults with ok=false.
 */
export function decodeHash(hash: string): { state: HashState; ok: boolean } {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '') return { state: DEFAULT_HASH_STATE, ok: true };
  const q = new URLSearchParams(raw);
  const fail = { state: DEFAULT_HASH_STATE, ok: false };
  if (q.get('v') !== HASH_VERSION) return fail;
  const seed = Number(q.get('seed'));
  if (!Number.isInteger(seed) || seed < 0) return fail;
  const view = q.get('view') as ViewMode;
  if (!VIEWS.includes(view)) return fail;
  const partial: Partial<Params> = {};
  for (const key of NUMERIC_KEYS) {
    const s = q.get(key);
    if (s === null) continue;
    const n = Number(s);
    if (s.trim() === '' || !Number.isFinite(n)) return fail;
    partial[key] = n;
  }
  for (const key of BOOLEAN_KEYS) {
    const s = q.get(key);
    if (s === null) continue;
    if (s !== '0' && s !== '1') return fail;
    partial[key] = s === '1';
  }
  return { state: { params: clampParams(partial), seed, view }, ok: true };
}
