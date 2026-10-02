import { useSyncExternalStore } from 'react';

/** Réglages d'affichage de développement (jamais utilisés pour le jeu normal). */
export interface ViewState { devClose: boolean; devSide: boolean; overlay: boolean; info: boolean }
let state: ViewState = { devClose: false, devSide: false, overlay: false, info: false };
const listeners = new Set<() => void>();
export const viewStore = {
  get: () => state,
  set(p: Partial<ViewState>) { state = { ...state, ...p }; listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};
export const useView = () => useSyncExternalStore(viewStore.subscribe, viewStore.get);

/** Données de la superposition de debug, mises à jour par l'animal à chaque image (sans re-rendu React). */
export const overlayData = {
  target: null as { x: number; z: number } | null,
  arriveRadius: 0.09,
  pos: { x: 0, z: 0 },
  plants: [] as { x: number; y: number; z: number }[],
  pois: [] as { id: string; x: number; z: number; r: number }[],
  /** Repères de contact (museau, coussinet, pieds tenus) : mis à jour par l'animal quand la superposition est affichée. */
  markers: [] as { x: number; y: number; z: number; color: string }[],
};
