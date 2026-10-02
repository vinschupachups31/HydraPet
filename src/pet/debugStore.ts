import { useSyncExternalStore } from 'react';

export interface DebugSnapshot {
  mode: string;
  gait: string;
  autonomy: boolean;
  speed: number;
  heading: number;
  x: number;
  z: number;
  idleW: number;
  walkW: number;
  runW: number;
  walkTS: number;
  runTS: number;
  pivoting: boolean;
  phase: string;
  omega: number;
  gaze: number;
  fps: number;
  loaded: boolean;
  clips: string;
}

export interface DebugCommands {
  call?: () => void;
  toggleGait?: () => void;
  toggleAutonomy?: () => void;
  touch?: () => void;
  goTo?: (x: number, z: number, gait?: 'walk' | 'run') => void;
}

let snap: DebugSnapshot = {
  mode: '-', gait: 'auto', autonomy: true, speed: 0, heading: 0, x: 0, z: 0, idleW: 1, walkW: 0, runW: 0,
  walkTS: 1, runTS: 1, pivoting: false, phase: 'idle', omega: 0, gaze: 0, fps: 0, loaded: false, clips: '',
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
