import { useSyncExternalStore } from 'react';

export type StepStatus = 'run' | 'ok' | 'fail';
export interface DiagLine { t: number; id: string; status: StepStatus; text: string }

let lines: DiagLine[] = [];
let version = 0;
const listeners = new Set<() => void>();
const t0 = Date.now();

const emit = () => { version++; lines = [...lines]; listeners.forEach((l) => l()); };

/** Journal de diagnostic : chaque étape d'un test s'y inscrit (démarrage, résultat, erreur). */
export const diag = {
  reset() { lines = []; emit(); },
  step(id: string, status: StepStatus, text: string) {
    const i = lines.findIndex((l) => l.id === id);
    const line = { t: (Date.now() - t0) / 1000, id, status, text };
    if (i >= 0) lines[i] = line; else lines.push(line);
    emit();
  },
  error(id: string, e: unknown) {
    const err = e as { message?: string; stack?: string };
    const msg = `${err?.message ?? String(e)}`.slice(0, 600);
    this.step(id, 'fail', msg);
  },
  get: () => lines,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  version: () => version,
};

export const useDiagLines = () => useSyncExternalStore(diag.subscribe, diag.get);
