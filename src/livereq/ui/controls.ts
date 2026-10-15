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
