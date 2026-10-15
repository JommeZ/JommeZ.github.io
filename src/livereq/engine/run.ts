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
