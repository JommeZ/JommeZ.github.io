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
