/** FrameGuard : vérifie qu'une position (et une pose) garde le compagnon ENTIER dans la zone sûre de l'écran.
 *  On projette les points d'une enveloppe conservatrice par pose (tête, oreilles, queue, pattes : voir tools/extract-envelopes.mts),
 *  tournée selon le cap, jamais le maillage skinné. Calculs purs ; aucune allocation notable dans `fits` (appelé à fréquence réduite). */
import { DEFAULT_SAFE_ZONE, SafeZoneConfig } from '../config/camera';
import { FOX_ENVELOPES } from '../config/foxEnvelopes';
import { Framing } from './framing';

export type EnvelopeKey = 'stand' | 'walk' | 'sit' | 'groom' | 'lie' | 'sleep' | 'stretch';

const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export class FrameGuard {
  constructor(private framing: () => Framing, private cfg: SafeZoneConfig = DEFAULT_SAFE_ZONE, private envelopes: Record<string, number[][]> = FOX_ENVELOPES) {}

  /** Bornes de la zone sûre pour le cadrage courant (portrait → paysage en fonction du ratio). */
  rect() {
    const f = this.framing(), k = smooth(0.75, 1.4, f.aspect);
    const side = this.cfg.sidePortrait + (this.cfg.sideLandscape - this.cfg.sidePortrait) * k;
    return { x0: side, x1: 1 - side, y0: this.cfg.top, y1: this.cfg.bottomPortrait + (this.cfg.bottomLandscape - this.cfg.bottomPortrait) * k };
  }

  /** Vrai si tous les points de l'enveloppe de la pose, placée en (x, z) avec le cap donné, sont dans la zone sûre (hors rectangles d'interface). */
  fitsPose(x: number, z: number, heading: number, key: EnvelopeKey, grow = 0): boolean {
    const env = this.envelopes[key] ?? this.envelopes.stand, f = this.framing(), r = this.rect();
    const c = Math.cos(heading), s = Math.sin(heading); // cap : l'avant est (sin h, cos h), la gauche (cos h, -sin h)
    for (const [ex, ey, ez] of env) {
      const wx = x + ex * c + ez * s, wz = z - ex * s + ez * c;
      const p = f.project(wx, ey, wz);
      if (p.depth < f.near * 2) return false;
      if (p.x < r.x0 - grow || p.x > r.x1 + grow || p.y < r.y0 - grow || p.y > r.y1 + grow) return false;
      for (const u of this.cfg.uiRects) if (p.x > u.x0 && p.x < u.x1 && p.y > u.y0 && p.y < u.y1) return false;
    }
    return true;
  }

  /** Destination : pose attendue au cap d'arrivée, et pose conservatrice tournée de ±90° (observation, examen). */
  fitsDestination(x: number, z: number, travelHeading: number, key: EnvelopeKey = 'stand'): boolean {
    for (const d of this.cfg.headingSpread) if (!this.fitsPose(x, z, travelHeading + d, d === 0 ? key : 'walk', d === 0 ? 0 : this.cfg.turnGrow)) return false; // les demi-tours sur place balaient le corps de côté : tolérance réduite
    return true;
  }

  /** Pose d'activité (assis, couché…) : valable quel que soit le cap d'arrivée (8 caps testés). */
  fitsAnyHeading(x: number, z: number, key: EnvelopeKey, grow = 0): boolean {
    for (let i = 0; i < 8; i++) if (!this.fitsPose(x, z, (i * Math.PI) / 4, key, grow)) return false;
    return true;
  }

  /** Cap le plus proche de `prefer` pour lequel la pose entière tient dans la zone sûre (16 caps testés), ou null. */
  bestHeading(x: number, z: number, key: EnvelopeKey, prefer: number, grow = 0): number | null {
    let best: number | null = null, bd = Infinity;
    for (let i = 0; i < 16; i++) {
      const h = (i * Math.PI) / 8;
      if (!this.fitsPose(x, z, h, key, grow)) continue;
      const d = Math.abs(((h - prefer + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  /** Chemin : points échantillonnés tous les 12 cm, enveloppe de marche au cap du trajet, avec une petite tolérance dans les virages. */
  pathFits(ax: number, az: number, bx: number, bz: number): boolean {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 0.12)), h = Math.atan2(bx - ax, bz - az);
    const startOut = !this.fitsPose(ax, az, h, 'walk', 0.012); // déjà hors zone : le début du chemin sert justement à y revenir
    for (let i = 1; i <= n; i++) { const t = i / n; if (startOut && t * len < 0.5) continue; if (!this.fitsPose(ax + (bx - ax) * t, az + (bz - az) * t, h, 'walk', 0.012)) return false; }
    return true;
  }
}
