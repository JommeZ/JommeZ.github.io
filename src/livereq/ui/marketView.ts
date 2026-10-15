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
