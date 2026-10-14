# LiveReq Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive agent-based simulation of the LiveReq response-bond job board to the Astro site at `/demos/livereq/`, listed as a project.

**Architecture:** A pure, seeded TypeScript engine (`src/livereq/engine/`) runs a whole 84-day simulation up front and returns one `Snapshot` per day; a thin DOM layer (`src/livereq/ui/`) renders settings, an SVG market view and SVG small-multiple charts, and plays back the snapshots. The page is an Astro route with a header-less layout so the existing `DemoEmbed` iframe can show it.

**Tech Stack:** Astro 7, TypeScript (Astro strict tsconfig), Vitest 3.2.4, plain DOM + inline SVG (no UI framework, no chart library).

**Spec:** `docs/superpowers/specs/2026-10-14-livereq-sim-design.md`

**Provenance:** every code block below was run in a scratch prototype before this plan was written: `astro check` reports 0 errors, all 61 Vitest tests pass, `astro build` emits `/demos/livereq/index.html`, and the page was smoke-tested in a simulated DOM. Copy blocks exactly; the tests' numeric expectations (calibration ranges, directional effects) depend on the exact model constants.

## Global Constraints

- Node ≥ 22.12 is required by Astro (`package.json` `engines`). This machine has Node 20 and no version manager, so every command runs through `npx -y node@22`, exactly as written in each step. If `node -v` prints v22.12 or later, plain `npm test` / `npm run build` work too.
- Vitest is pinned to `3.2.4`. No other new dependencies.
- No UI framework, no chart library: SVG is built as strings.
- Engine modules (`src/livereq/engine/*`) must not touch the DOM; the UI depends on the engine, never the reverse.
- Same params + seed ⇒ identical snapshots (spec §8).
- Styling uses the site's CSS variables from `src/styles/global.css` (`--bg`, `--bg-alt`, `--text`, `--text-muted`, `--accent`, `--border`, `--font-mono`) and works in light and dark (`prefers-color-scheme`).
- Work on branch `livereq-sim` (already created; the spec is committed there).
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Hand-edited or outdated share links** (`#v=0…`, `bond=abc`, `audits=yes`): the page must show the defaults plus a dismissible notice, never crash. Pinned by the `decodeHash` cases in Task 2.
2. **Extreme slider combinations** (bond 0, 1 token, cap 10, every employer a ghost job, a 7-day run): metrics must stay finite and "applications per hire" must be `null` (drawn as "–"), not `NaN`/`Infinity`. Pinned by the `edge settings` test in Task 5.
3. **Employer-type sliders summing past 100%:** shares are scaled down proportionally, not rejected. Pinned by the `clampParams` share test in Task 2.
4. **Side-by-side fairness:** both modes must start from the same seekers and employers for a seed, or the comparison is meaningless. Pinned by `starts both modes from the same population` in Task 3.
5. **Budget limits under pressure:** a seeker never applies more than `T` times in a week, and the payout cap is never exceeded on any single payout. Pinned by the two budget invariants in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/livereq/engine/rng.ts` | Seeded PRNG (mulberry32) with independent streams |
| `src/livereq/engine/types.ts` | All shared engine types |
| `src/livereq/engine/params.ts` | Defaults, ranges, clamping, presets, URL-hash encode/decode, model constants |
| `src/livereq/engine/state.ts` | Initial population, adding seekers/postings, volume and effort curves |
| `src/livereq/engine/employers.ts` | Action costs, cheapest-action choice, daily review phase |
| `src/livereq/engine/seekers.ts` | Choosing postings and submitting applications |
| `src/livereq/engine/market.ts` | One day: refill, apply, review, deadline, audits, hires, lifecycle, badges |
| `src/livereq/engine/metrics.ts` | `SimState` → `Snapshot` |
| `src/livereq/engine/run.ts` | `simulate` / `runSimulation` over all days |
| `src/livereq/ui/controls.ts` | Settings form built from a control list |
| `src/livereq/ui/charts.ts` | SVG small-multiple line charts |
| `src/livereq/ui/marketView.ts` | SVG market view (employer columns of outcome dots) |
| `src/livereq/ui/app.ts` | Wiring: hash state, recompute, playback |
| `src/layouts/DemoLayout.astro` | Header-less layout for demos in an iframe |
| `src/pages/demos/livereq/index.astro` | Page markup, styles, script entry |
| `src/data/projects.ts` | Modify: add the LiveReq project entry |
| `package.json` | Modify: add `vitest` dev dependency and `test` script |

---

### Task 1: Test tooling and seeded RNG

**Files:**
- Modify: `package.json`
- Create: `src/livereq/engine/rng.ts`
- Test: `src/livereq/engine/rng.test.ts`

**Interfaces:**
- Produces: `interface Rng { next(): number; int(n: number): number; chance(p: number): boolean; normal(): number }` and `createRng(seed: number, stream = 0): Rng`. Streams are independent sequences for the same seed; later tasks use stream 1 for the initial population and stream 2 for daily dynamics.

- [ ] **Step 1: Install Vitest**

Run: `cd /home/johan/personal-website && npx -y node@22 "$(which npm)" install -D vitest@3.2.4`
Expected: `package.json` gains `"vitest": "^3.2.4"` under `devDependencies`.

- [ ] **Step 2: Add the test script** — in `package.json` `"scripts"`, after `"astro": "astro"`, add `"test": "vitest run"` so the block reads:

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Write the failing test** — create `src/livereq/engine/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

const draw = (seed: number, stream = 0, n = 5) => {
  const r = createRng(seed, stream);
  return Array.from({ length: n }, () => r.next());
};

describe('createRng', () => {
  it('repeats the same sequence for the same seed and stream', () => {
    expect(draw(42)).toEqual(draw(42));
  });

  it('gives different sequences for different seeds or streams', () => {
    expect(draw(42)).not.toEqual(draw(43));
    expect(draw(42, 1)).not.toEqual(draw(42, 2));
  });

  it('stays within [0, 1) and int(n) within [0, n)', () => {
    const r = createRng(7);
    const xs = Array.from({ length: 10_000 }, () => r.next());
    const ks = new Set(Array.from({ length: 1_000 }, () => r.int(3)));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect([...ks].sort()).toEqual([0, 1, 2]);
  });

  it('produces normals with mean ~0 and sd ~1', () => {
    const r = createRng(9);
    const xs = Array.from({ length: 20_000 }, () => r.normal());
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/rng.test.ts`
Expected: FAIL — cannot resolve `./rng`

- [ ] **Step 5: Implement** — create `src/livereq/engine/rng.ts`:

```ts
export interface Rng {
  next(): number;
  int(n: number): number;
  chance(p: number): boolean;
  normal(): number;
}

function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h >>> 0;
}

/** mulberry32. `stream` picks an independent sequence for the same seed. */
export function createRng(seed: number, stream = 0): Rng {
  let a = mix(seed >>> 0, stream);
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    chance: (p) => next() < p,
    normal: () => {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/rng.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 7: Commit**

```bash
git add src/livereq/engine/rng.test.ts src/livereq/engine/rng.ts package.json package-lock.json
git commit -m "Add Vitest and seeded RNG for LiveReq engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Engine types and parameters

**Files:**
- Create: `src/livereq/engine/types.ts`, `src/livereq/engine/params.ts`
- Test: `src/livereq/engine/params.test.ts`

**Interfaces:**
- Consumes: `Rng` (type only) from Task 1.
- Produces (types): `Mode = 'statusQuo' | 'liveReq'`, `ViewMode = Mode | 'sideBySide'`, `EmployerType`, `SeekerType`, `ReasonCode`, `AppState`, `Params`, `Application`, `Seeker`, `OutcomeCounts`, `Posting`, `Slot`, `Counters`, `SimState`, `PostingView`, `Snapshot` — exactly as in `types.ts` below.
- Produces (values): `CONSTANTS`, `DEFAULT_PARAMS`, `RANGES: Record<NumericKey, [min, max, integer]>`, `BOOLEAN_KEYS`, `NUMERIC_KEYS`, `clampParams(input: Partial<Params>): Params`, `interface Preset { id; label; view: ViewMode; params: Params }`, `PRESETS: Preset[]` (ids `today`, `basic`, `audits`, `farmers`, `countermeasures`), `interface HashState { params; seed; view }`, `HASH_VERSION = '1'`, `DEFAULT_HASH_STATE`, `encodeHash(state: HashState): string`, `decodeHash(hash: string): { state: HashState; ok: boolean }`.

- [ ] **Step 1: Create the types** — create `src/livereq/engine/types.ts` (types only, nothing to test on its own):

```ts
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
```

- [ ] **Step 2: Write the failing test** — create `src/livereq/engine/params.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/params.test.ts`
Expected: FAIL — cannot resolve `./params`

- [ ] **Step 4: Implement** — create `src/livereq/engine/params.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/params.test.ts`
Expected: PASS — 14 tests

- [ ] **Step 6: Commit**

```bash
git add src/livereq/engine/params.test.ts src/livereq/engine/params.ts src/livereq/engine/types.ts
git commit -m "Add LiveReq engine types, params, presets and hash encoding

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Initial population and volume curves

**Files:**
- Create: `src/livereq/engine/state.ts`
- Test: `src/livereq/engine/state.test.ts`

**Interfaces:**
- Consumes: `createRng`, `Rng` (Task 1); `CONSTANTS`, `clampParams` and types (Task 2).
- Produces: `clamp01(x)`, `statusQuoAppsPerWeek(friction): number` (8 at friction 1 … 40 at friction 0), `weeklyApps(params, mode): number`, `effortFor(appsPerWeek): number`, `emptyOutcomeCounts(): OutcomeCounts`, `addSeeker(state, rng, budget): Seeker`, `openPosting(state, rng, slot, type, openedDay): Posting` (pays the bond in LiveReq), `createState(params, seed, mode): SimState`.

- [ ] **Step 1: Write the failing test** — create `src/livereq/engine/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clampParams } from './params';
import { createState, effortFor, statusQuoAppsPerWeek } from './state';

describe('volume and effort', () => {
  it('maps friction to weekly applications', () => {
    expect(statusQuoAppsPerWeek(1)).toBe(8);
    expect(statusQuoAppsPerWeek(0)).toBe(40);
    expect(statusQuoAppsPerWeek(0.6)).toBe(21);
  });

  it('lowers effort as volume rises', () => {
    expect(effortFor(15)).toBeCloseTo(0.625);
    expect(effortFor(100)).toBeCloseTo(0.2);
  });
});

describe('createState', () => {
  it('assigns employer types by exact quota', () => {
    const state = createState(clampParams({ postings: 40, diligentShare: 0.25, ghostShare: 0.15 }), 1, 'statusQuo');
    const count = (t: string) => state.slots.filter((s) => s.type === t).length;
    expect(count('diligent')).toBe(10);
    expect(count('ghost')).toBe(6);
    expect(count('rational')).toBe(24);
  });

  it('starts both modes from the same population for a seed', () => {
    const params = clampParams({ farmerShare: 0.2 });
    const a = createState(params, 5, 'statusQuo');
    const b = createState(params, 5, 'liveReq');
    expect(b.seekers.map((s) => [s.quality, s.type])).toEqual(a.seekers.map((s) => [s.quality, s.type]));
    expect(b.slots.map((s) => [s.type, s.current.openings, s.current.bar])).toEqual(
      a.slots.map((s) => [s.type, s.current.openings, s.current.bar]),
    );
  });

  it('pays one bond per opening posting only in LiveReq', () => {
    const params = clampParams({ postings: 10, bond: 500 });
    expect(createState(params, 1, 'liveReq').counters.bondPaidIn).toBe(5000);
    expect(createState(params, 1, 'statusQuo').counters.bondPaidIn).toBe(0);
  });

  it('gives ghost employers no openings', () => {
    const state = createState(clampParams({ ghostShare: 1, diligentShare: 0 }), 1, 'liveReq');
    expect(state.slots.every((s) => s.current.openings === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/state.test.ts`
Expected: FAIL — cannot resolve `./state`

- [ ] **Step 3: Implement** — create `src/livereq/engine/state.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/state.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/livereq/engine/state.test.ts src/livereq/engine/state.ts
git commit -m "Add LiveReq initial population and volume curves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Employer decisions and review phase

**Files:**
- Create: `src/livereq/engine/employers.ts`
- Test: `src/livereq/engine/employers.test.ts`

**Interfaces:**
- Consumes: `CONSTANTS` (Task 2), `createState`/`clampParams` in tests (Tasks 2–3).
- Produces: `type Action = 'review' | 'stamp' | 'ghost'`, `interface ActionCosts { review; stamp; ghost }`, `actionCosts(state): ActionCosts`, `cheapest(costs): Action`, `chooseAction(state, posting): Action`, `interface ReviewOutcome { declines: Application[]; advanced: Application[] }`, `reviewPhase(state): ReviewOutcome`.
- `reviewPhase` is exercised end to end by Task 5's simulation tests; here only the pricing rules get unit tests.

- [ ] **Step 1: Write the failing test** — create `src/livereq/engine/employers.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/employers.test.ts`
Expected: FAIL — cannot resolve `./employers`

- [ ] **Step 3: Implement** — create `src/livereq/engine/employers.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/employers.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/livereq/engine/employers.test.ts src/livereq/engine/employers.ts
git commit -m "Add LiveReq employer action pricing and review phase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Daily market loop, metrics and simulation runner

**Files:**
- Create: `src/livereq/engine/seekers.ts`, `src/livereq/engine/market.ts`, `src/livereq/engine/metrics.ts`, `src/livereq/engine/run.ts`
- Test: `src/livereq/engine/run.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `applyPhase(state): void` (seekers.ts); `step(state): void` (market.ts, day order: refill → apply → review → deadline → audits → hires → lifecycle → badges); `snapshot(state): Snapshot` (metrics.ts); `simulate(params, seed, mode): { state: SimState; snapshots: Snapshot[] }` and `runSimulation(params, seed, mode): Snapshot[]` (run.ts). The UI uses only `runSimulation`.

- [ ] **Step 1: Write the failing test** — create `src/livereq/engine/run.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/run.test.ts`
Expected: FAIL — cannot resolve `./run`

- [ ] **Step 3: Implement** — create `src/livereq/engine/seekers.ts`:

```ts
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
```

- [ ] **Step 4: Implement** — create `src/livereq/engine/market.ts`:

```ts
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
      counters.forfeits += posting.bondRemaining;
      posting.bondRemaining = 0;
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
```

- [ ] **Step 5: Implement** — create `src/livereq/engine/metrics.ts`:

```ts
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
```

- [ ] **Step 6: Implement** — create `src/livereq/engine/run.ts`:

```ts
import { step } from './market';
import { snapshot } from './metrics';
import { createState } from './state';
import type { Mode, Params, SimState, Snapshot } from './types';

export function simulate(params: Params, seed: number, mode: Mode): { state: SimState; snapshots: Snapshot[] } {
  const state = createState(params, seed, mode);
  const snapshots: Snapshot[] = [];
  for (let day = 0; day < params.days; day++) {
    state.day = day;
    step(state);
    snapshots.push(snapshot(state));
  }
  return { state, snapshots };
}

export function runSimulation(params: Params, seed: number, mode: Mode): Snapshot[] {
  return simulate(params, seed, mode).snapshots;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run src/livereq/engine/run.test.ts`
Expected: PASS — 33 tests, including calibration (apps/hire 200–400, interview rate 2.5–9.5%, seekers ghosted 40–80%) and the five directional effects. The suite takes about 10 seconds

- [ ] **Step 8: Commit**

```bash
git add src/livereq/engine/run.test.ts src/livereq/engine/seekers.ts src/livereq/engine/market.ts src/livereq/engine/metrics.ts src/livereq/engine/run.ts
git commit -m "Add LiveReq daily market loop, metrics and runner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Run the whole engine suite**

Run: `npx -y node@22 node_modules/vitest/vitest.mjs run`
Expected: PASS — 61 tests in 5 files.

---

### Task 6: UI renderers (controls, charts, market view)

**Files:**
- Create: `src/livereq/ui/controls.ts`, `src/livereq/ui/charts.ts`, `src/livereq/ui/marketView.ts`

**Interfaces:**
- Consumes: `RANGES`, `clampParams` (Task 2); `Params`, `Snapshot`, `PostingView` types.
- Produces: `CONTROLS: ControlDef[]` and `renderControls(root: HTMLElement, onChange: (params: Params) => void): { set(params: Params): void }` (controls.ts); `METRICS` and `renderCharts(root: HTMLElement, primary: Snapshot[], baseline: Snapshot[] | undefined, day: number): void` (charts.ts); `OUTCOMES: { id; label }[]` and `renderMarket(svg: SVGSVGElement, snapshot: Snapshot): void` (marketView.ts).
- The spec sets "no UI unit tests"; these are verified by `astro check` here and in the browser in Task 7.
- CSS class names the page styles in Task 7: `.control`, `.control--range`, `.control--checkbox`, `.chart`, `.series`, `.series--baseline`, `.ref`, `.ref-label`, `.axis`, `.baseline-value`, `.posting`, `.posting--closed`, `.hit`, `.type`, `.badge`, `.dot`, `.dot--{advanced|declined|stamped|ghosted|paid|pending}`.

- [ ] **Step 1: Create the settings form** — create `src/livereq/ui/controls.ts`:

```ts
import { RANGES } from '../engine/params';
import type { Params } from '../engine/types';
import { clampParams } from '../engine/params';

type Group = 'Market' | 'Status quo' | 'Review costs' | 'Population' | 'Countermeasures';

export interface ControlDef {
  key: keyof Params;
  label: string;
  group: Group;
  kind: 'range' | 'checkbox';
  /** Narrower UI range than the engine allows; defaults to RANGES. */
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

export const CONTROLS: ControlDef[] = [
  { key: 'bond', label: 'Bond B', group: 'Market', kind: 'range', max: 10000, step: 100, format: usd },
  { key: 'cap', label: 'Applicant cap C', group: 'Market', kind: 'range', max: 300, step: 10 },
  { key: 'deadline', label: 'Deadline D (days)', group: 'Market', kind: 'range', max: 21 },
  { key: 'tokens', label: 'Tokens T / week', group: 'Market', kind: 'range', max: 25 },
  { key: 'friction', label: 'Application friction', group: 'Status quo', kind: 'range', step: 0.05, format: pct },
  { key: 'triageMinutes', label: 'Triage (min)', group: 'Review costs', kind: 'range', max: 5, step: 0.5 },
  { key: 'fullReadMinutes', label: 'Full read (min)', group: 'Review costs', kind: 'range', max: 45 },
  { key: 'hourlyCost', label: 'Recruiter $/hour', group: 'Review costs', kind: 'range', max: 150, step: 5, format: usd },
  { key: 'diligentShare', label: 'Diligent employers', group: 'Population', kind: 'range', step: 0.05, format: pct },
  { key: 'ghostShare', label: 'Ghost-job employers', group: 'Population', kind: 'range', step: 0.05, format: pct },
  { key: 'farmerShare', label: 'Payout farmers', group: 'Population', kind: 'range', max: 0.5, step: 0.05, format: pct },
  { key: 'audits', label: 'Reason-code audits', group: 'Countermeasures', kind: 'checkbox' },
  { key: 'auditRate', label: 'Audit rate a', group: 'Countermeasures', kind: 'range', step: 0.05, format: pct },
  { key: 'payoutCap', label: 'Payout cap per seeker', group: 'Countermeasures', kind: 'checkbox' },
  { key: 'payoutCapPerWeek', label: 'Max payouts / week', group: 'Countermeasures', kind: 'range', max: 5 },
  { key: 'history', label: 'Responsive-employer badge', group: 'Countermeasures', kind: 'checkbox' },
];

export interface ControlsHandle {
  set(params: Params): void;
}

/** Build the settings form. `onChange` gets clamped params on every input. */
export function renderControls(root: HTMLElement, onChange: (params: Params) => void): ControlsHandle {
  let current: Params = clampParams({});
  const inputs = new Map<keyof Params, { input: HTMLInputElement; output?: HTMLOutputElement; def: ControlDef }>();
  const groups = new Map<Group, HTMLFieldSetElement>();

  for (const def of CONTROLS) {
    let fieldset = groups.get(def.group);
    if (!fieldset) {
      fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = def.group;
      fieldset.append(legend);
      root.append(fieldset);
      groups.set(def.group, fieldset);
    }
    const label = document.createElement('label');
    label.className = `control control--${def.kind}`;
    const input = document.createElement('input');
    input.name = def.key;
    input.type = def.kind;
    const text = document.createElement('span');
    text.textContent = def.label;
    let output: HTMLOutputElement | undefined;
    if (def.kind === 'range') {
      const [min, max, integer] = RANGES[def.key as keyof typeof RANGES];
      input.min = String(def.min ?? min);
      input.max = String(def.max ?? max);
      input.step = String(def.step ?? (integer ? 1 : 0.01));
      output = document.createElement('output');
      label.append(text, output, input);
    } else {
      label.append(input, text);
    }
    input.addEventListener('input', () => {
      const raw = def.kind === 'checkbox' ? input.checked : Number(input.value);
      current = clampParams({ ...current, [def.key]: raw });
      sync();
      onChange(current);
    });
    fieldset.append(label);
    inputs.set(def.key, { input, output, def });
  }

  function sync(): void {
    for (const [key, { input, output, def }] of inputs) {
      const value = current[key];
      if (typeof value === 'boolean') input.checked = value;
      else {
        input.value = String(value);
        if (output) output.textContent = def.format ? def.format(value) : String(value);
      }
    }
  }

  return {
    set(params) {
      current = params;
      sync();
    },
  };
}
```

- [ ] **Step 2: Create the charts** — create `src/livereq/ui/charts.ts`:

```ts
import type { Snapshot } from '../engine/types';

interface MetricDef {
  id: string;
  label: string;
  pick: (s: Snapshot) => number | null;
  format: (v: number) => string;
  /** Fixed y-range for shares; otherwise scaled to the data. */
  share?: boolean;
  refs?: { value: number; label: string }[];
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number) => Math.round(v).toLocaleString('en-US');
const usd = (v: number) => `$${num(v)}`;

export const METRICS: MetricDef[] = [
  { id: 'apph', label: 'Applications per hire', pick: (s) => s.appsPerHire, format: num, refs: [{ value: 291, label: 'Ashby 291' }] },
  { id: 'ghost', label: 'Applicants ghosted', pick: (s) => s.ghostedShare, format: pct, share: true },
  { id: 'stamp', label: 'Declines rubber-stamped', pick: (s) => s.stampedShare, format: pct, share: true },
  {
    id: 'interview',
    label: 'Interview rate per application',
    pick: (s) => s.interviewRate,
    format: pct,
    refs: [
      { value: 0.0925, label: 'Huntr 11–20/wk' },
      { value: 0.0258, label: 'Huntr 100+' },
    ],
  },
  { id: 'payG', label: 'Payouts to genuine seekers', pick: (s) => s.counters.payoutsGenuine, format: usd },
  { id: 'payF', label: 'Payouts to farmers', pick: (s) => s.counters.payoutsFarmer, format: usd },
  { id: 'hours', label: 'Recruiter hours', pick: (s) => s.recruiterHours, format: num },
];

const W = 260;
const H = 110;
const PAD = { top: 8, right: 8, bottom: 16, left: 8 };

function line(points: [number, number][], cls: string): string {
  if (points.length === 0) return '';
  return `<polyline class="${cls}" fill="none" points="${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" />`;
}

function chart(def: MetricDef, primary: Snapshot[], baseline: Snapshot[] | undefined, day: number): string {
  const total = primary.length;
  const all = [...primary, ...(baseline ?? [])].map(def.pick).filter((v): v is number => v !== null);
  const refMax = Math.max(0, ...(def.refs ?? []).map((r) => r.value));
  const yMax = def.share ? 1 : Math.max(refMax, ...all, 1e-9) * 1.1;
  const x = (d: number) => PAD.left + (d / Math.max(1, total - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => H - PAD.bottom - (v / yMax) * (H - PAD.top - PAD.bottom);
  const series = (snaps: Snapshot[]): [number, number][] =>
    snaps
      .slice(0, day + 1)
      .map((s): [number, number] | null => {
        const v = def.pick(s);
        return v === null ? null : [x(s.day), y(v)];
      })
      .filter((p): p is [number, number] => p !== null);
  const refs = (def.refs ?? [])
    .map(
      (r) =>
        `<line class="ref" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(r.value)}" y2="${y(r.value)}" />` +
        `<text class="ref-label" x="${W - PAD.right}" y="${y(r.value) - 2}" text-anchor="end">${r.label}</text>`,
    )
    .join('');
  const current = def.pick(primary[Math.min(day, total - 1)]);
  const base = baseline ? def.pick(baseline[Math.min(day, total - 1)]) : null;
  const value =
    (current === null ? '–' : def.format(current)) + (baseline ? ` <span class="baseline-value">vs ${base === null ? '–' : def.format(base)}</span>` : '');
  return `<figure class="chart">
  <figcaption><span>${def.label}</span><strong>${value}</strong></figcaption>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${def.label}">
    <line class="axis" x1="${PAD.left}" x2="${W - PAD.right}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom}" />
    ${refs}
    ${baseline ? line(series(baseline), 'series series--baseline') : ''}
    ${line(series(primary), 'series')}
  </svg>
</figure>`;
}

export function renderCharts(root: HTMLElement, primary: Snapshot[], baseline: Snapshot[] | undefined, day: number): void {
  root.innerHTML = METRICS.map((m) => chart(m, primary, baseline, day)).join('');
}
```

- [ ] **Step 3: Create the market view** — create `src/livereq/ui/marketView.ts`:

```ts
import type { PostingView, Snapshot } from '../engine/types';

const DOTS = 20;
const COL = 22;
const DOT = 7;
const TOP = 26;
const H = TOP + DOTS * (DOT + 2) + 4;

type Outcome = 'advanced' | 'declined' | 'stamped' | 'ghosted' | 'paid' | 'pending';
export const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: 'advanced', label: 'Advanced' },
  { id: 'declined', label: 'Declined' },
  { id: 'stamped', label: 'Rubber-stamped' },
  { id: 'ghosted', label: 'Ghosted' },
  { id: 'paid', label: 'Ghosted, payout collected' },
  { id: 'pending', label: 'Waiting' },
];

const TYPE_LETTER = { diligent: 'D', rational: 'R', ghost: 'G' } as const;

function counts(p: PostingView): Record<Outcome, number> {
  return {
    advanced: p.counts.advanced,
    declined: p.counts.declined,
    stamped: p.counts.stamped,
    ghosted: p.counts.ghosted - p.paid,
    paid: p.paid,
    pending: p.pending,
  };
}

/** Allocate DOTS dots proportionally (largest remainder), so each column is comparable. */
function allocate(c: Record<Outcome, number>): Outcome[] {
  const total = OUTCOMES.reduce((sum, o) => sum + c[o.id], 0);
  if (total === 0) return [];
  const raw = OUTCOMES.map((o) => ({ id: o.id, exact: (c[o.id] / total) * DOTS }));
  const n = raw.map((r) => ({ ...r, whole: Math.floor(r.exact) }));
  let left = DOTS - n.reduce((s, r) => s + r.whole, 0);
  for (const r of [...n].sort((a, b) => b.exact - b.whole - (a.exact - a.whole))) {
    if (left-- <= 0) break;
    r.whole++;
  }
  return n.flatMap((r) => Array<Outcome>(r.whole).fill(r.id));
}

function tooltip(p: PostingView): string {
  const c = counts(p);
  const lines = [`Employer ${p.slot + 1} (${p.type})${p.badge ? ' · responsive badge' : ''}${p.accepting ? '' : ' · closed'}`];
  for (const o of OUTCOMES) if (c[o.id] > 0) lines.push(`${o.label}: ${c[o.id]}`);
  const reasons = Object.entries(p.reasons).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
  if (reasons.length) lines.push('Reason codes — ' + reasons.join(', '));
  return lines.join('\n');
}

export function renderMarket(svg: SVGSVGElement, snapshot: Snapshot): void {
  const width = snapshot.postings.length * COL;
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  svg.innerHTML = snapshot.postings
    .map((p, i) => {
      const x = i * COL + COL / 2;
      const dots = allocate(counts(p))
        .map((o, k) => `<circle class="dot dot--${o}" cx="${x}" cy="${H - 4 - k * (DOT + 2) - DOT / 2}" r="${DOT / 2}" />`)
        .join('');
      return `<g class="posting${p.accepting ? '' : ' posting--closed'}">
  <title>${tooltip(p)}</title>
  <rect class="hit" x="${i * COL}" y="0" width="${COL}" height="${H}" />
  <text class="type" x="${x}" y="11" text-anchor="middle">${TYPE_LETTER[p.type]}</text>
  ${p.badge ? `<text class="badge" x="${x}" y="22" text-anchor="middle">★</text>` : ''}
  ${dots}
</g>`;
    })
    .join('');
}
```

- [ ] **Step 4: Type-check**

Run: `cd /home/johan/personal-website && npx -y node@22 node_modules/astro/bin/astro.mjs check`
Expected: `0 errors`. The 6 hints about the deprecated `z` in `src/content.config.ts` already exist and are unrelated.

- [ ] **Step 5: Commit**

```bash
git add src/livereq/ui/controls.ts src/livereq/ui/charts.ts src/livereq/ui/marketView.ts
git commit -m "Add LiveReq settings form, charts and market view renderers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Demo page, wiring and project entry

**Files:**
- Create: `src/livereq/ui/app.ts`, `src/layouts/DemoLayout.astro`, `src/pages/demos/livereq/index.astro`
- Modify: `src/data/projects.ts` (append one entry to `projects`)

**Interfaces:**
- Consumes: `PRESETS`, `DEFAULT_HASH_STATE`, `decodeHash`, `encodeHash`, `HashState` (Task 2); `runSimulation` (Task 5); `renderControls`, `renderCharts`, `renderMarket`, `OUTCOMES` (Task 6).
- Produces: `start(): void` (app.ts), called once by the page script. Element ids the page must provide: `#lr-notice`, `#lr-notice-close`, `#lr-charts`, `#lr-market`, `#lr-day`, `#lr-play`, `#lr-step`, `#lr-reset`, `#lr-end`, `#lr-speed`, `#lr-seed`, `#lr-preset`, `#lr-controls` (a `<details>`), `#lr-form`, and buttons with `data-view`.

- [ ] **Step 1: Create the app wiring** — create `src/livereq/ui/app.ts`:

```ts
import { DEFAULT_HASH_STATE, PRESETS, decodeHash, encodeHash, type HashState } from '../engine/params';
import { runSimulation } from '../engine/run';
import type { Snapshot, ViewMode } from '../engine/types';
import { renderCharts } from './charts';
import { renderControls } from './controls';
import { renderMarket } from './marketView';

interface Runs {
  primary: Snapshot[];
  baseline?: Snapshot[];
}

function $<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`LiveReq: missing ${selector}`);
  return el;
}

function compute(s: HashState): Runs {
  if (s.view === 'statusQuo') return { primary: runSimulation(s.params, s.seed, 'statusQuo') };
  const primary = runSimulation(s.params, s.seed, 'liveReq');
  return s.view === 'sideBySide' ? { primary, baseline: runSimulation(s.params, s.seed, 'statusQuo') } : { primary };
}

export function start(): void {
  const decoded = decodeHash(location.hash);
  let state: HashState = decoded.state;
  let runs = compute(state);
  let day = 0;
  let playing = false;
  let last = 0;
  let carry = 0;

  const notice = $<HTMLElement>('#lr-notice');
  notice.hidden = decoded.ok;
  $<HTMLButtonElement>('#lr-notice-close').addEventListener('click', () => (notice.hidden = true));

  const charts = $<HTMLElement>('#lr-charts');
  const market = $<SVGSVGElement>('#lr-market');
  const dayLabel = $<HTMLElement>('#lr-day');
  const playBtn = $<HTMLButtonElement>('#lr-play');
  const speed = $<HTMLInputElement>('#lr-speed');
  const seedInput = $<HTMLInputElement>('#lr-seed');
  const presetSelect = $<HTMLSelectElement>('#lr-preset');
  const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const details = $<HTMLDetailsElement>('#lr-controls');
  if (matchMedia('(max-width: 720px)').matches) details.open = false;

  for (const [value, label] of [...PRESETS.map((p) => [p.id, p.label]), ['custom', 'Custom']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    presetSelect.append(option);
  }

  const controls = renderControls($<HTMLElement>('#lr-form'), (params) => update({ ...state, params }));

  function draw(): void {
    const last = runs.primary.length - 1;
    day = Math.min(day, last);
    renderCharts(charts, runs.primary, runs.baseline, day);
    renderMarket(market, runs.primary[day]);
    dayLabel.textContent = `Day ${day + 1} / ${last + 1}`;
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
  }

  function syncChrome(): void {
    controls.set(state.params);
    seedInput.value = String(state.seed);
    for (const b of viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
    const match = PRESETS.find((p) => p.view === state.view && JSON.stringify(p.params) === JSON.stringify(state.params));
    presetSelect.value = match ? match.id : 'custom';
  }

  /** Any settings change reruns the whole simulation from day 0. */
  function update(next: HashState): void {
    state = next;
    runs = compute(state);
    day = 0;
    history.replaceState(null, '', encodeHash(state));
    syncChrome();
    draw();
  }

  function tick(now: number): void {
    if (!playing) return;
    carry += ((now - last) / 1000) * Number(speed.value);
    last = now;
    const steps = Math.floor(carry);
    carry -= steps;
    if (steps > 0) {
      day = Math.min(day + steps, runs.primary.length - 1);
      if (day === runs.primary.length - 1) playing = false;
      draw();
    }
    if (playing) requestAnimationFrame(tick);
  }

  playBtn.addEventListener('click', () => {
    if (!playing && day === runs.primary.length - 1) day = 0;
    playing = !playing;
    last = performance.now();
    carry = 0;
    draw();
    if (playing) requestAnimationFrame(tick);
  });
  $<HTMLButtonElement>('#lr-step').addEventListener('click', () => {
    playing = false;
    day = Math.min(day + 1, runs.primary.length - 1);
    draw();
  });
  $<HTMLButtonElement>('#lr-reset').addEventListener('click', () => {
    playing = false;
    day = 0;
    draw();
  });
  $<HTMLButtonElement>('#lr-end').addEventListener('click', () => {
    playing = false;
    day = runs.primary.length - 1;
    draw();
  });
  seedInput.addEventListener('change', () => {
    const seed = Math.max(0, Math.floor(Number(seedInput.value)));
    update({ ...state, seed: Number.isFinite(seed) ? seed : DEFAULT_HASH_STATE.seed });
  });
  presetSelect.addEventListener('change', () => {
    const preset = PRESETS.find((p) => p.id === presetSelect.value);
    if (preset) update({ ...state, params: preset.params, view: preset.view });
  });
  for (const b of viewButtons) b.addEventListener('click', () => update({ ...state, view: b.dataset.view as ViewMode }));

  syncChrome();
  draw();
}
```

- [ ] **Step 2: Create the demo layout** — create `src/layouts/DemoLayout.astro`:

```astro
---
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Interactive demo by Jomme.' } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="description" content={description} />
    <title>{title} · Jomme</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 3: Create the page** — create `src/pages/demos/livereq/index.astro`:

```astro
---
import DemoLayout from '../../../layouts/DemoLayout.astro';
import { OUTCOMES } from '../../../livereq/ui/marketView';
---

<DemoLayout title="LiveReq sim" description="Agent-based simulation of a job board where employers post a response bond.">
  <div class="lr">
    <header class="lr-bar">
      <h1>LiveReq sim</h1>
      <div class="lr-views" role="group" aria-label="Mode">
        <button type="button" data-view="statusQuo">Status quo</button>
        <button type="button" data-view="liveReq">LiveReq</button>
        <button type="button" data-view="sideBySide">Side-by-side</button>
      </div>
      <div class="lr-playback">
        <button type="button" id="lr-play">▶ Play</button>
        <button type="button" id="lr-step">⏭ Step</button>
        <button type="button" id="lr-reset">↺ Reset</button>
        <button type="button" id="lr-end">⇥ End</button>
        <label>Speed <input id="lr-speed" type="range" min="1" max="30" value="8" /></label>
        <label>Seed <input id="lr-seed" type="number" min="0" step="1" /></label>
        <label>Preset <select id="lr-preset"></select></label>
      </div>
    </header>

    <p id="lr-notice" class="lr-notice" hidden>
      That link's settings couldn't be read, so the defaults are shown.
      <button type="button" id="lr-notice-close" aria-label="Dismiss">×</button>
    </p>

    <div class="lr-main">
      <details id="lr-controls" class="lr-controls" open>
        <summary>Settings</summary>
        <form id="lr-form" onsubmit="return false"></form>
      </details>

      <section class="lr-output">
        <div class="lr-market-head">
          <h2>Market</h2>
          <span id="lr-day" class="lr-day"></span>
        </div>
        <div class="lr-market-scroll">
          <svg id="lr-market" class="lr-market" role="img" aria-label="Employers and their applicants by outcome"></svg>
        </div>
        <ul class="lr-legend">
          {OUTCOMES.map((o) => <li><span class={`swatch dot--${o.id}`}></span>{o.label}</li>)}
          <li>D/R/G = diligent / rational / ghost-job employer · ★ = responsive badge</li>
        </ul>
        <p class="lr-hint">In side-by-side mode the market shows LiveReq; the charts draw the status quo dashed.</p>
        <div id="lr-charts" class="lr-charts"></div>
      </section>
    </div>

    <footer class="lr-sources">
      Calibration sources:
      <a href="https://huntr.co/research/job-search-trends-q1-2026" target="_blank" rel="noopener">Huntr Q1 2026</a> ·
      <a href="https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf" target="_blank" rel="noopener">TheLadders eye-tracking</a> ·
      <a href="https://help.workable.com/hc/en-us/articles/16965390312215-What-is-a-Responsive-Employer-Badge-on-Indeed" target="_blank" rel="noopener">Indeed responsive badge</a> ·
      <a href="https://support.greenhouse.io/hc/en-us/articles/360000769051" target="_blank" rel="noopener">Greenhouse rejection reasons</a> ·
      <a href="https://docs.ashbyhq.com/application-limits" target="_blank" rel="noopener">Ashby application limits</a> ·
      <a href="https://fortune.com/2025/02/02/linkedin-indeed-greenhouse-job-seekers-likely-response-interviews/" target="_blank" rel="noopener">Fortune on response signals</a>.
      Numbers are mostly vendor- or self-reported; treat them as rough targets.
    </footer>
  </div>
</DemoLayout>

<script>
  import { start } from '../../../livereq/ui/app';
  start();
</script>

<style is:global>
  .lr {
    --c-advanced: #2f9e44;
    --c-declined: #868e96;
    --c-stamped: #e8590c;
    --c-ghosted: #c92a2a;
    --c-paid: #9c36b5;
    --c-pending: #ced4da;
    padding: 0.75rem 1rem 1.5rem;
    font-size: 0.9rem;
  }
  @media (prefers-color-scheme: dark) {
    .lr {
      --c-advanced: #51cf66;
      --c-declined: #adb5bd;
      --c-stamped: #ff922b;
      --c-ghosted: #ff6b6b;
      --c-paid: #da77f2;
      --c-pending: #495057;
    }
  }
  .lr h1 { font-size: 1.15rem; margin: 0; }
  .lr h2 { font-size: 1rem; margin: 0; }
  .lr button, .lr select, .lr input[type='number'] {
    font: inherit; color: var(--text); background: var(--bg-alt);
    border: 1px solid var(--border); border-radius: 6px; padding: 0.2rem 0.55rem;
  }
  .lr input[type='number'] { width: 5.5rem; }
  .lr button[aria-pressed='true'] { background: var(--accent); color: #fff; border-color: var(--accent); }
  .lr-bar { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; margin-bottom: 0.75rem; }
  .lr-views, .lr-playback { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  .lr-playback label { display: inline-flex; gap: 0.35rem; align-items: center; color: var(--text-muted); }
  .lr-notice { display: flex; gap: 0.5rem; align-items: center; background: var(--bg-alt); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.6rem; }
  .lr-main { display: grid; grid-template-columns: 16rem 1fr; gap: 1rem; }
  .lr-controls summary { cursor: pointer; font-weight: 600; }
  .lr-controls fieldset { border: 1px solid var(--border); border-radius: 6px; margin: 0.5rem 0 0; padding: 0.35rem 0.6rem 0.5rem; }
  .lr-controls legend { color: var(--text-muted); font-size: 0.8rem; padding: 0 0.25rem; }
  .control { display: grid; grid-template-columns: 1fr auto; gap: 0 0.5rem; margin: 0.3rem 0; }
  .control input[type='range'] { grid-column: 1 / -1; width: 100%; }
  .control output { font-family: var(--font-mono); font-size: 0.8rem; }
  .control--checkbox { display: flex; gap: 0.4rem; align-items: center; }
  .lr-market-head { display: flex; justify-content: space-between; align-items: baseline; }
  .lr-day { font-family: var(--font-mono); color: var(--text-muted); }
  .lr-market-scroll { overflow-x: auto; }
  .lr-market { display: block; min-width: 100%; height: 13rem; }
  .lr-market .hit { fill: transparent; }
  .lr-market .posting:hover .hit { fill: var(--bg-alt); }
  .lr-market .posting--closed { opacity: 0.55; }
  .lr-market .type { font: 600 10px var(--font-mono); fill: var(--text-muted); }
  .lr-market .badge { font-size: 10px; fill: var(--accent); }
  .dot--advanced { fill: var(--c-advanced); background: var(--c-advanced); }
  .dot--declined { fill: var(--c-declined); background: var(--c-declined); }
  .dot--stamped { fill: var(--c-stamped); background: var(--c-stamped); }
  .dot--ghosted { fill: var(--c-ghosted); background: var(--c-ghosted); }
  .dot--paid { fill: var(--c-paid); background: var(--c-paid); }
  .dot--pending { fill: var(--c-pending); background: var(--c-pending); }
  .lr-legend { display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; list-style: none; padding: 0; margin: 0.4rem 0; color: var(--text-muted); font-size: 0.8rem; }
  .lr-legend .swatch { display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 50%; margin-right: 0.3rem; }
  .lr-hint { color: var(--text-muted); font-size: 0.8rem; margin: 0 0 0.5rem; }
  .lr-charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.75rem; }
  .chart { margin: 0; border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.5rem; }
  .chart figcaption { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); }
  .chart figcaption strong { color: var(--text); font-family: var(--font-mono); font-weight: 600; }
  .chart .baseline-value { color: var(--text-muted); font-weight: 400; }
  .chart svg { width: 100%; height: auto; display: block; }
  .chart .axis { stroke: var(--border); }
  .chart .series { stroke: var(--accent); stroke-width: 2; }
  .chart .series--baseline { stroke: var(--text-muted); stroke-dasharray: 4 3; stroke-width: 1.5; }
  .chart .ref { stroke: var(--text-muted); stroke-width: 0.75; stroke-dasharray: 1 2; }
  .chart .ref-label { font-size: 8px; fill: var(--text-muted); }
  .lr-sources { margin-top: 1.25rem; color: var(--text-muted); font-size: 0.8rem; }
  @media (max-width: 720px) {
    .lr-main { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 4: Add the project entry** — in `src/data/projects.ts`, append this object as the last element of the `projects` array, after the `melodifestivalen-quiz` entry:

```ts
  {
    slug: 'livereq',
    title: 'LiveReq',
    description: 'An agent-based simulation of a job board where employers post a response bond, with seeker tokens, gaming and countermeasures.',
    tags: ['simulation', 'typescript', 'mechanism-design'],
    demoUrl: '/demos/livereq/',
  },
```

- [ ] **Step 5: Type-check, test and build**

Run: `cd /home/johan/personal-website && npx -y node@22 node_modules/astro/bin/astro.mjs check && npx -y node@22 node_modules/vitest/vitest.mjs run && npx -y node@22 node_modules/astro/bin/astro.mjs build`
Expected: `0 errors`; 61 tests pass; the build log lists `/demos/livereq/index.html` and `/projects/livereq/index.html` and ends with `Complete!`.

- [ ] **Step 6: Manual browser check** — start the dev server in the background, as `CLAUDE.md` asks: `npx -y node@22 node_modules/astro/bin/astro.mjs dev --background`, then open `http://localhost:4321/demos/livereq/` and `http://localhost:4321/projects/livereq/`. Check each item and stop the server afterwards with `npx -y node@22 node_modules/astro/bin/astro.mjs dev stop`:
  - [ ] The page loads with the **LiveReq basic** preset in side-by-side mode: 7 charts with a dashed status-quo line and a 40-column market view.
  - [ ] ▶ Play animates to day 84 and stops; ⏭ Step, ↺ Reset and ⇥ End work.
  - [ ] Choosing **Audits on** drops "Declines rubber-stamped" to 0%. Choosing **Farmers attack** makes "Payouts to farmers" rise above $0.
  - [ ] Moving the Bond slider changes the URL hash and switches the preset dropdown to "Custom". Reloading the page restores the same run.
  - [ ] Opening `/demos/livereq/#v=0` shows the "couldn't be read" notice, and × dismisses it.
  - [ ] Hovering a market column shows its counts and reason codes.
  - [ ] It works in both light and dark OS themes.
  - [ ] At about 400px width the settings collapse into a "Settings" drawer and nothing overflows except the market strip, which scrolls horizontally.
  - [ ] On `/projects/livereq/` the demo works inside the iframe.

- [ ] **Step 7: Commit**

```bash
git add src/livereq/ui/app.ts src/layouts/DemoLayout.astro src/pages/demos/livereq/index.astro src/data/projects.ts
git commit -m "Add LiveReq simulator demo page and project entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
