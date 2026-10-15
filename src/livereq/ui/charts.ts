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
