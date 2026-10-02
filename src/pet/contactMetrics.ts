/** Mesure du glissement des appuis, en coordonnées monde. Logique pure (aucune dépendance au moteur 3D) : utilisée par le diagnostic
 *  intégré à l'application et par les outils hors ligne. Seules les phases d'appui IDENTIFIÉES (métadonnées du clip) sont mesurées : le
 *  mouvement volontaire de la patte pendant la levée n'est jamais compté comme du glissement.
 *  Trois classes de glissement :
 *   - longitudinal : cadence incompatible avec la translation (corps qui avance, pas de rotation) ;
 *   - latéral : le corps tourne pendant l'appui (vitesse angulaire moyenne élevée) ;
 *   - à l'arrêt : translation résiduelle ou transition d'animation incorrecte (corps arrêté, pied qui bouge). */

export type Phase = 'stance' | 'swing' | 'none';
export type SlipClass = 'longitudinal' | 'latéral' | 'arrêt';
export interface FootSample { x: number; y: number; z: number; phase: Phase }
export interface BodySample { t: number; x: number; z: number; heading: number; speed: number; omega: number }

export interface SlipConfig {
  /** Longueur de référence du corps (m) : tête → base de la queue. */
  bodyLength: number;
  /** Seuil de glissement = relThreshold × bodyLength. */
  relThreshold: number;
  /** Début d'appui ignoré (s) : le temps que le pied se pose. */
  settle: number;
  /** Corps considéré à l'arrêt sous cette vitesse (m/s) et rotation significative au-dessus de cette vitesse angulaire (rad/s). */
  stopSpeed: number;
  turnOmega: number;
  /** Durée minimale d'un arrêt mesuré (s). */
  minRest: number;
}
export const DEFAULT_SLIP: SlipConfig = { bodyLength: 0.4, relThreshold: 0.04, settle: 0.1, stopSpeed: 0.05, turnOmega: 0.25, minRest: 0.8 };
export const slipThreshold = (c: SlipConfig = DEFAULT_SLIP) => c.relThreshold * c.bodyLength;

export interface SlipRun {
  foot: number;
  kind: 'appui' | 'arrêt';
  t0: number; t1: number;
  slip: number; longitudinal: number; lateral: number;
  cls: SlipClass;
  over: boolean;
  meanSpeed: number; meanOmega: number;
}

/** Couleur d'un point de trajectoire : vert appui, bleu levée, rouge appui qui dépasse le seuil. */
export type TrailColor = 'green' | 'blue' | 'red';
export interface TrailPoint { foot: number; x: number; y: number; z: number; color: TrailColor }

interface Open { kind: 'appui' | 'arrêt'; t0: number; ref: { x: number; z: number } | null; hx: number; hz: number; n: number; sp: number; om: number; slip: number; lon: number; lat: number; over: boolean; start: BodySample }

export class ContactTracker {
  readonly runs: SlipRun[] = [];
  readonly trail: TrailPoint[] = [];
  private open: (Open | null)[] = [null, null, null, null];
  private minY = [Infinity, Infinity, Infinity, Infinity];
  private stopSince = -1;
  maxTrail = 6000;
  constructor(public cfg: SlipConfig = DEFAULT_SLIP) {}

  reset() { this.runs.length = 0; this.trail.length = 0; this.open = [null, null, null, null]; this.stopSince = -1; }

  push(b: BodySample, feet: FootSample[]) {
    const thr = slipThreshold(this.cfg);
    const stopped = b.speed < this.cfg.stopSpeed;
    if (!stopped) this.stopSince = -1; else if (this.stopSince < 0) this.stopSince = b.t;
    feet.forEach((f, i) => {
      this.minY[i] = Math.min(this.minY[i], f.y);
      const grounded = f.y < this.minY[i] + 0.012;
      // un pied nettement soulevé (petit pas de rattrapage) n'est pas en contact, même si le clip annonce un appui
      const phase: Phase = f.phase === 'stance' && !grounded ? 'swing' : f.phase;
      // une phase est « appui » (clip) ; à l'arrêt prolongé, un pied au sol est mesuré comme « arrêt »
      const resting = stopped && this.stopSince >= 0 && b.t - this.stopSince >= this.cfg.minRest && grounded;
      const want: Open['kind'] | null = phase === 'stance' ? 'appui' : resting ? 'arrêt' : null;
      let o = this.open[i];
      if (o && want !== o.kind) { this.close(i, b.t); o = null; }
      let color: TrailColor = phase === 'stance' ? 'green' : 'blue';
      if (want) {
        if (!o) { o = { kind: want, t0: b.t, ref: null, hx: Math.sin(b.heading), hz: Math.cos(b.heading), n: 0, sp: 0, om: 0, slip: 0, lon: 0, lat: 0, over: false, start: b }; this.open[i] = o; }
        o.n++; o.sp += b.speed; o.om += Math.abs(b.omega);
        if (b.t - o.t0 >= this.cfg.settle) {
          if (!o.ref) o.ref = { x: f.x, z: f.z };
          const dx = f.x - o.ref.x, dz = f.z - o.ref.z, d = Math.hypot(dx, dz);
          if (d > o.slip) { o.slip = d; o.lon = Math.abs(dx * o.hx + dz * o.hz); o.lat = Math.abs(dx * o.hz - dz * o.hx); }
          if (d > thr) { o.over = true; color = 'red'; }
          else if (o.over) color = 'red';
        }
      }
      this.trail.push({ foot: i, x: f.x, y: f.y, z: f.z, color });
    });
    if (this.trail.length > this.maxTrail) this.trail.splice(0, this.trail.length - this.maxTrail);
  }

  private close(i: number, t: number) {
    const o = this.open[i]; this.open[i] = null;
    if (!o || !o.ref) return;
    const ms = o.sp / o.n, mo = o.om / o.n;
    const cls: SlipClass = o.kind === 'arrêt' || ms < this.cfg.stopSpeed ? 'arrêt' : mo > this.cfg.turnOmega ? 'latéral' : 'longitudinal';
    this.runs.push({ foot: i, kind: o.kind, t0: o.t0, t1: t, slip: o.slip, longitudinal: o.lon, lateral: o.lat, cls, over: o.slip > slipThreshold(this.cfg), meanSpeed: ms, meanOmega: mo });
  }

  finish(t: number) { for (let i = 0; i < 4; i++) this.close(i, t); }

  report() {
    const thr = slipThreshold(this.cfg);
    const by = (c: SlipClass) => {
      const r = this.runs.filter((x) => x.cls === c).map((x) => x.slip).sort((a, b) => a - b);
      return { n: r.length, median: r.length ? r[Math.floor(r.length / 2)] : 0, max: r.length ? r[r.length - 1] : 0, over: this.runs.filter((x) => x.cls === c && x.over).length };
    };
    const all = this.runs.map((x) => x.slip).sort((a, b) => a - b);
    return {
      threshold: { relative: this.cfg.relThreshold, bodyLength: this.cfg.bodyLength, metres: thr },
      total: { n: all.length, median: all.length ? all[Math.floor(all.length / 2)] : 0, max: all.length ? all[all.length - 1] : 0, over: this.runs.filter((x) => x.over).length },
      longitudinal: by('longitudinal'), lateral: by('latéral'), arret: by('arrêt'),
    };
  }
}
