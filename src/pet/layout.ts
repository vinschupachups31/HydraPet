/** Géométrie de la pièce : sol, obstacles, zones de profondeur, accessibilité (corps entier, pas seulement le centre). */
import { Zone } from '../config/behavior';
import { ROOM } from '../config/pet';
import type { FrameGuard } from './frameGuard';

export interface Box { id: string; minX: number; maxX: number; minZ: number; maxZ: number }

export const SOFA: Box = { id: 'sofa', minX: 0.2, maxX: 1.7, minZ: -1.7, maxZ: -0.9 };
export const FLOOR = { minX: -ROOM.width / 2, maxX: ROOM.width / 2, minZ: -ROOM.depth / 2, maxZ: ROOM.depth / 2 };
export const OBSTACLES: Box[] = [SOFA];

export const zoneOf = (z: number): Zone => (z < -0.7 ? 'back' : z > 0.7 ? 'front' : 'mid');

/** Champ visible de la caméra : demi-largeur de sol visible à la profondeur z (m), et profondeur maximale visible. */
export interface ViewLimits { halfWidthAt(z: number): number; maxZ: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Position réelle d'un point d'intérêt : relative au champ visible (xn) ou absolue (mobilier). */
export function resolvePoi(poi: { x: number; z: number; xn?: number }, view: ViewLimits | null, margin: number): { x: number; z: number } {
  if (poi.xn === undefined) return { x: poi.x, z: poi.z };
  const usable = view ? Math.max(0.15, view.halfWidthAt(poi.z) - margin) : 0.6;
  return { x: poi.xn * usable, z: poi.z };
}

export class WalkArea {
  view: ViewLimits | null = null;
  /** Zone sûre à l'écran : le compagnon entier doit y tenir (voir frameGuard.ts). */
  guard: FrameGuard | null = null;
  constructor(public obstacles: Box[] = OBSTACLES, public floor = FLOOR) {}

  /** Distance d'un point à une boîte (0 si dedans). */
  private distToBox(b: Box, x: number, z: number): number {
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    return Math.hypot(dx, dz);
  }

  /** Espace libre pour un corps de rayon r centré en (x, z). `inView` : reste dans le champ de la caméra (moins une marge). */
  isFree(x: number, z: number, r: number, inView = false, viewMargin = 0): boolean {
    const f = this.floor;
    if (x < f.minX + r || x > f.maxX - r || z < f.minZ + r || z > f.maxZ - r) return false;
    for (const b of this.obstacles) if (this.distToBox(b, x, z) < r) return false;
    if (inView && this.view) {
      if (z > this.view.maxZ) return false;
      if (Math.abs(x) > this.view.halfWidthAt(z) - viewMargin) return false;
    }
    return true;
  }

  /** Segment libre pour un corps de rayon r (échantillonné tous les ~8 cm). */
  segmentFree(ax: number, az: number, bx: number, bz: number, r: number): boolean {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.08));
    for (let i = 1; i <= n; i++) { // le point de départ est supposé valide (le corps y est déjà, ex. au premier plan)
      const t = i / n;
      if (!this.isFree(ax + (bx - ax) * t, az + (bz - az) * t, r)) return false;
    }
    return true;
  }

  /** Repousse un point hors des obstacles et le garde dans la pièce : le corps glisse le long du mobilier au lieu de le traverser. */
  resolve(p: { x: number; z: number }, r: number) {
    const f = this.floor;
    p.x = clamp(p.x, f.minX + r, f.maxX - r);
    p.z = clamp(p.z, f.minZ + r, f.maxZ - r);
    for (const b of this.obstacles) {
      const cx = clamp(p.x, b.minX, b.maxX);
      const cz = clamp(p.z, b.minZ, b.maxZ);
      let dx = p.x - cx, dz = p.z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-6) { // centre dans la boîte : sort par le côté le plus proche
        const left = p.x - b.minX, right = b.maxX - p.x, up = p.z - b.minZ, down = b.maxZ - p.z;
        const m = Math.min(left, right, up, down);
        if (m === left) { p.x = b.minX - r; } else if (m === right) { p.x = b.maxX + r; } else if (m === up) { p.z = b.minZ - r; } else { p.z = b.maxZ + r; }
        continue;
      }
      dx /= d; dz /= d;
      p.x = cx + dx * r;
      p.z = cz + dz * r;
    }
  }
}
