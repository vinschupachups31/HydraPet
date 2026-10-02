import { useSyncExternalStore } from 'react';

export interface DebugSnapshot {
  // comportement
  state: string;
  remaining: number;
  poi: string;
  zone: string;
  tripsInRow: number;
  nextApproachIn: number;
  // locomotion
  phase: string;
  speedRequested: number;
  speedReal: number;
  omega: number;
  gaze: number;
  distance: number;
  // animation
  clip: string;
  idleW: number;
  walkW: number;
  runW: number;
  walkRate: number;
  runRate: number;
  feet: string;
  // général
  gait: string;
  autonomy: boolean;
  ik: boolean;
  fps: number;
  loaded: boolean;
  clips: string;
}

export interface DebugCommands {
  call?: () => void;
  toggleGait?: () => void;
  toggleAutonomy?: () => void;
  toggleIK?: () => void;
  touch?: () => void;
  goTo?: (x: number, z: number, gait?: 'walk' | 'run') => void;
}

let snap: DebugSnapshot = {
  state: '-', remaining: 0, poi: '-', zone: '-', tripsInRow: 0, nextApproachIn: 0,
  phase: 'idle', speedRequested: 0, speedReal: 0, omega: 0, gaze: 0, distance: 0,
  clip: 'repos', idleW: 1, walkW: 0, runW: 0, walkRate: 1, runRate: 1, feet: '',
  gait: 'auto', autonomy: true, ik: true, fps: 0, loaded: false, clips: '',
};
const listeners = new Set<() => void>();

export const debugStore = {
  get: () => snap,
  set(p: Partial<DebugSnapshot>) {
    snap = { ...snap, ...p };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  commands: {} as DebugCommands,
};

export const useDebug = () => useSyncExternalStore(debugStore.subscribe, debugStore.get);
