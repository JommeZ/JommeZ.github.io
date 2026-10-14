# LiveReq Simulator — Design

Date: 2026-10-14
Status: Draft for review

## 1. Purpose

LiveReq is a job-board concept where employers post a **response bond**: every
applicant gets a human-reviewed status (advance or decline with a reason code)
within a deadline, or the bond pays out to applicants. Seekers get a limited
number of weekly application **tokens**.

This project is a **portfolio / learning piece**, not a product. It is an
interactive, agent-based simulation that shows whether the mechanism works,
where it breaks under gaming, and which countermeasures repair it. All money is
fake. There are no accounts, payments, or real job data.

### Success criteria

- A visitor can compare "status quo" and "LiveReq" on the same seed and see the
  differences in ghosting, applications per hire, and interview rate.
- The sim shows at least one gaming attack and a countermeasure for it.
- The "Today's job market" preset lands roughly on real-world calibration
  figures (section 4.6).
- The engine is pure, deterministic and tested, so a later guided-explainer
  page can reuse it unchanged.

### Scope

In scope (v1):
1. Ghosting vs bond: employers trade review cost against bond payout.
2. Application flood vs tokens: limits on applications improve selectivity and per-application quality.
3. Gaming: rubber-stamped declines (employers) and payout farming
   (seekers), plus countermeasures.

Out of scope (v1): ghost jobs as a separate mechanic (modeled only as an
employer type), post-interview ghosting, the guided scrolling explainer, a
Web Worker, real accounts or payments, and charting libraries.

## 2. Placement in the site

- Built by Astro as a page, not a static file in `public/demos/`, so the
  engine can be TypeScript and tested.
- `src/layouts/DemoLayout.astro`: a standalone layout without the site header
  or footer, so the page works inside the existing `DemoEmbed` iframe. It reuses
  the CSS variables from `src/styles/global.css`.
- `src/pages/demos/livereq/index.astro` is served at `/demos/livereq/`.
- `src/data/projects.ts` gets a new entry: slug `livereq`, title "LiveReq",
  tags `['simulation', 'typescript', 'mechanism-design']`, and
  `demoUrl: '/demos/livereq/'`.

## 3. Domain grounding (from research of existing job sites)

The model borrows the following conventions from real job sites and ATS
products. The numbers are mostly vendor-reported or self-reported, so they are
rough calibration targets, not facts. The page credits them in a "Sources" footer.

| Real-world convention | Source | Used as |
|---|---|---|
| ATS pipeline stages; "rejected" is a flag with a reason, grouped by who initiated it | Greenhouse, Lever help docs | Application states and reason codes |
| A "response" is an application status update | Indeed responsive-employer rules (via Workable and CareerPlug) | Definition of a response |
| Two-pass screening: ~6–7 s fit/no-fit triage, then a full read | TheLadders eye-tracking study | Triage and full-read cost |
| More applications per week means lower interview rate (9.25% at 11–20 apps vs 2.58% at 100+; 1.91% after 8+ apps to the same company) | Huntr Q1 2026 | Effort vs volume curve, calibration |
| Typical seeker sends ~10–20 applications/week | LoopCV, Huntr | Status-quo seeker volume |
| Responsive-employer badge: >51% response over a rolling 30 days | Indeed (via ATS vendors) | "Visible history" countermeasure |
| Employer-side application throttling and reapply blocks | Ashby application limits | Precedent for tokens |
| Ghost-job share ~1 in 7 to ~27% of postings | Various 2026 estimates | Default ghost-employer share 15% |
| ~291 applications per hire | Axios / Ashby, Aug 2026 | Calibration target |
| ~53% of seekers ghosted in the past year | Fortune / Criteria Corp, Mar 2026 | Calibration target |

## 4. Simulation model

### 4.1 Time and scale

- One step is one day. Default run is 84 days (12 weeks).
- Defaults: 500 seekers and 40 postings. Each posting has 1–3 openings.
- Modes: **Status quo**, **LiveReq**, and **Side-by-side** (both modes on the
  same seed).

### 4.2 Applications and reason codes

An application moves through these states:

`applied → triaged → full_read → advanced (interview) → hired`

It can end early in one of these terminal states:

- `declined(reason)`: genuine decline after a review.
- `stamped(reason)`: decline after triage only, with an unsupported reason.
- `ghosted`: no status by the deadline (status quo: never gets a status).
- `withdrawn`: the seeker was hired elsewhere.

Reason codes come from Greenhouse's defaults:
- Company-initiated: `lacks_skills`, `preferred_another`, `not_a_fit`,
  `duplicate`, `spam`.
- Candidate-initiated: `withdrew`.

The LiveReq deadline `D` applies **only to the first decision**: advance or
decline. What happens after an interview is not bonded.

### 4.3 Employers (postings)

Each posting has:
- openings;
- daily review capacity, in recruiter-minutes per day;
- `triageCost`, in minutes, small;
- `fullReadCost`, in minutes, larger;
- an employer type.

Under LiveReq it also has the applicant cap `C`, the bond `B` and the deadline `D`.

Employer types (shares adjustable, must sum to 100%):
- **Diligent**: triages every applicant and fully reads every applicant that passes triage. Never rubber-stamps.
- **Rational**: reviews in arrival order, using full reads, until its openings are
  filled. After that, or for applicants it does not need, it picks the
  cheapest option out of
  - a full review: `fullReadCost` × the value of recruiter time;
  - ghosting: `B / C` under LiveReq, 0 in the status quo;
  - rubber-stamping: expected cost is `a × B`, the audit probability times losing the whole bond, plus a small triage cost.
- **Ghost**: posts but never hires. Gives no responses unless forced by cost; under LiveReq it behaves as Rational about the bond but has 0 openings.

Each day an employer spends its capacity on triage first (oldest first), then
on full reads. A full read reveals the seeker's true fit. The employer advances
the applicant if the fit is above the posting's bar and declines them otherwise.

A **rubber-stamp** is a decline issued after triage only, giving a reason that
triage could not justify. The usual case is `lacks_skills` for a seeker whose
true fit is above the bar.

### 4.4 Seekers

Each seeker has:
- hidden `quality` (0–1);
- a per-posting `fit` (quality plus noise);
- a type, Genuine or Farmer (the farmer share is adjustable).

**Status quo:** a seeker sends a number of applications per week, defaulting to
the 10–20 range, which increases as application friction falls. **Effort per
application** falls as volume rises. Effort scales how clearly the seeker's
fit shows to the employer. Lower effort means more noise in triage, so more
good candidates are dropped. This curve is calibrated so the per-application
interview rate approaches Huntr's 9.25% (11–20/week) and 2.58% (100+).

**LiveReq:** a seeker gets `T` tokens per week, and one application costs one token. Genuine
seekers spend tokens on their highest-fit postings at full effort. When
visible history is on, they prefer badged employers.

**Farmers** spend tokens on postings most likely to miss the deadline, judged
by the employer's past response rate. If history is visible they target
unbadged employers. Their goal is to collect payouts, not jobs.

A seeker who gets hired stops applying, and their pending applications become
`withdrawn`.

### 4.5 Money and countermeasures

- The bond `B` is paid in when a posting opens.
- Each applicant still pending at day `D` gets `B / C`, until the bond runs out.
- Bond money left over when the posting closes is refunded to the employer.
- **Audit** (toggle, rate `a`): each decline is audited with probability `a`.
  An audit that finds a stamped decline forfeits the employer's remaining bond.
  The forfeit is shared among that posting's stamped applicants.
- **Payout cap** (toggle): a seeker can collect at most `k` payouts per week.
- **Visible history** (toggle): Indeed-style badge for a response rate over 51%
  across the rolling last 30 days, recalculated weekly. It affects which postings
  seekers choose. It has no direct financial effect.
- Posting fee ($199–499) is a display-only parameter, so v1 tracks it but does
  not change behavior.

Money must add up: total bond paid in = payouts + refunds + forfeits.

### 4.6 Metrics, recorded daily

- Applications per hire
- Share of applications ghosted
- Share of seekers ghosted at least once
- Share of declines that are rubber-stamped
- Interview rate per application
- Total bond paid out, split between farmers and genuine seekers
- Recruiter hours spent

Calibration ranges for the "Today's job market" preset (status quo):
- applications per hire: 200–400;
- share of seekers ghosted at least once: 40–65%. The real figure (~53%) is
  measured over a year; the sim covers 12 weeks, so this range is deliberately loose;
- interview rate: roughly between 2.5% and 9.5% depending on volume.

### 4.7 Presets

| Preset | Purpose |
|---|---|
| Today's job market | Status quo calibrated to section 4.6 |
| LiveReq basic | Bond plus tokens; no farmers; no countermeasures |
| Farmers attack | LiveReq basic with 20% farmers and Rational employers |
| Audits on | Farmers attack, with audits, payout cap and visible history on |

## 5. Page and UI

```
┌─────────────────────────────────────────────────────────┐
│ LiveReq sim    [Status quo | LiveReq | Side-by-side]    │
│ ▶ Play  ⏸  ⏭ Step  ↺ Reset  ⇥ End  Speed ──●──  Seed  │
│ Preset [Today's job market ▾]                           │
├──────────────┬──────────────────────────────────────────┤
│ Market       │  Market view (SVG)                       │
│  Bond B      │  employers in a row (badge if earned),   │
│  Cap C       │  applicant dots colored by outcome;      │
│  Deadline D  │  hover shows the reason code             │
│  Tokens T    ├──────────────────────────────────────────┤
│  Friction    │  Metric charts (SVG small multiples)     │
│  Triage/read │  apps/hire · % ghosted · % stamped ·     │
│ Population   │  interview rate (Huntr ref. lines) ·     │
│  employer mix│  payouts farmer vs genuine · rec. hours  │
│  farmer %    │  Side-by-side: status quo drawn dashed   │
│ Countermeas. │                                          │
│  ☐ audits a  │  Day 34 / 84                             │
│  ☐ payout cap│                                          │
│  ☐ history   │                                          │
└──────────────┴──────────────────────────────────────────┘
  Sources footer
```

- Dot colors: advanced, declined, stamped, ghosted, payout collected. The colors work in both light and dark themes.
- Changing any setting reruns the whole simulation from day 0. Playback then
  steps through the stored snapshots.
- The settings and seed are stored in the URL hash, so the same URL gives the same run.
- At phone width the controls collapse into a drawer above the charts.
- Styling uses the site's CSS variables and supports light and dark themes.

## 6. Code structure

```
src/livereq/engine/          pure TypeScript, no DOM code
  rng.ts        seeded PRNG (mulberry32), forkable streams
  types.ts      Params, Seeker, Posting, Application, ReasonCode, Snapshot
  params.ts     defaults, presets, clamping, hash encode/decode
  seekers.ts    application choice, effort curve, farmer targeting
  employers.ts  triage / full read / ghost / stamp decisions
  market.ts     step(state, params, rng) → state
  metrics.ts    snapshot(state) → Snapshot
  run.ts        runSimulation(params, seed) → Snapshot[]
src/livereq/ui/
  app.ts        wiring, playback loop (requestAnimationFrame)
  controls.ts   settings form ↔ Params
  marketView.ts SVG market view
  charts.ts     SVG small-multiple line charts
src/layouts/DemoLayout.astro
src/pages/demos/livereq/index.astro
src/livereq/engine/*.test.ts
```

Each module depends only on modules listed above it in `engine/`. The UI depends on
the engine, and the engine never depends on the UI.

### Order of events each day (`market.ts`)

1. On the first day of each week, refill tokens and reset the payout-cap counters.
2. Seekers apply.
3. Employers spend their capacity, triage first, then full reads; they make decisions.
4. Applications past the deadline are marked ghosted and receive payouts.
5. Audits run.
6. Hires happen; pending applications of hired seekers are withdrawn.
7. Every 7 days, badges are recalculated.
8. A snapshot is recorded.

### Data flow

Params and seed go to `runSimulation`, which produces `Snapshot[]` for all 84 days.
The UI only reads snapshots. Side-by-side runs the simulation twice. Target: one run
should take under 100 ms on a laptop. If it is slower, move it to a Web Worker
(deferred).

## 7. Error handling

- `params.ts` clamps every value to a valid range, and keeps the
  employer-type shares summing to 100%.
- An invalid or outdated URL hash falls back to the defaults. The page shows a
  small dismissible notice.
- The engine never throws during normal use. Invariant checks run only in tests.

## 8. Testing

- Vitest is added as a dev dependency, with a `"test": "vitest run"` script.
- **Determinism:** the same params and seed give deeply equal snapshots.
- **Invariants:**
  - every application ends in exactly one final state;
  - money adds up (section 4.5);
  - token spend never goes over the balance;
  - payouts never exceed the bond.
- **Direction of effects** (averaged over 5 seeds):
  - a larger `B` gives a lower share ghosted;
  - a smaller `T` gives fewer applications per hire;
  - audits on give a lower share stamped;
  - the payout cap gives lower farmer payouts.
- **Calibration:** "Today's job market" falls within the section 4.6 ranges.
- **Page:** `astro check`, `npm run build`, and a manual browser check in
  light and dark themes, at desktop and 400px widths, and inside `DemoEmbed`.

## 9. Open items for later (not v1)

- A guided explainer page reusing the presets as chapters.
- Ghost jobs as their own mechanic, with funded-role verification.
- Bonding post-interview responses.
- A Web Worker, if performance needs it.
