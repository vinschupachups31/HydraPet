/** PostureController : machine d'états des postures (debout, assis, couché, endormi) et des séquences qui les relient.
 *  Logique pure (aucune dépendance au moteur 3D) : elle produit une pose « à plat » (voir rig.ts) et un poids de couche.
 *  Une seule séquence à la fois : jamais deux transitions de posture superposées. Les ordres sont des BUTS (`request`) ;
 *  le contrôleur enchaîne lui-même les étapes (ex. endormi → couché → assis → debout). Aucun timer ni callback : tout avance dans `update(dt)`. */
import { BoneKey, FOX_BONES } from '../config/foxRig';
import { EDGES, POSES, Posture, PostureState, SEQUENCES, SequenceDef, blend, mirrorPose } from '../config/postures';
import { FOX_RIG } from '../config/foxRig';
import { Pose, compilePose, newPoseArray, POSE_SIZE } from './rig';
import { Rng } from './rng';

const BONE_ORDER = Object.keys(FOX_BONES) as BoneKey[];
const idx = (k: BoneKey, axis: 0 | 1 | 2) => BONE_ORDER.indexOf(k) * 3 + axis;
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export const IDLE_STATE: Record<Posture, PostureState> = { stand: 'StandingIdle', sit: 'SittingIdle', lie: 'Lying', sleep: 'Sleeping' };

interface ActiveSeq {
  id: number;
  def: Pick<SequenceDef, 'name' | 'from' | 'to' | 'anchors'>;
  arr: Float64Array[];
  t: number[];
  w: number[];
  contact: number[];
  /** Point de contact visé sur la tête par clé (cm, côté droit) : museau, joue, oreille. */
  pt: Float64Array[];
  duration: number;
  time: number;
  /** Index des clés où un geste se termine et où l'on peut interrompre (toilette). */
  safe: number[];
  abortAtKey: number;
}

const MUZZLE = new Float64Array(FOX_RIG.facePointsCm.muzzle);
const CHEEK = new Float64Array(FOX_RIG.facePointsCm.cheek);
const EAR = new Float64Array(FOX_RIG.facePointsCm.ear);
const compiled = new Map<SequenceDef, ActiveSeq['arr']>();
const compile = (d: SequenceDef) => { let c = compiled.get(d); if (!c) { c = d.keys.map((k) => compilePose(k.pose)); compiled.set(d, c); } return c; };
const POSE_ARR = Object.fromEntries(Object.entries(POSES).map(([k, p]) => [k, compilePose(p)]));

export interface PostureCfg {
  /** Respiration (degrés de tangage de la colonne) et fréquence (Hz) par posture. */
  breath: Partial<Record<Posture, { amp: number; hz: number }>>;
  /** Intervalles (s) entre deux frémissements de la queue pendant le sommeil. */
  sleepTwitch: [number, number];
  /** Toilette : durées (s) et nombres, tirés une seule fois au début de chaque phase ou de chaque geste. */
  groom: {
    install: [number, number]; pause1: [number, number]; shift: [number, number]; raise: [number, number];
    series: [number, number]; gestures: [number, number]; gestureDur: [number, number]; gestureAmp: [number, number]; gestureHold: [number, number];
    passes: [number, number]; passLeg: [number, number]; passHold: [number, number]; between: [number, number];
    away: [number, number]; down: [number, number]; recenter: [number, number]; observe: [number, number]; back: [number, number];
  };
}
export const DEFAULT_POSTURE: PostureCfg = {
  breath: { sit: { amp: 0.5, hz: 0.3 }, lie: { amp: 0.7, hz: 0.3 }, sleep: { amp: 1.1, hz: 0.27 } },
  sleepTwitch: [6, 14],
  groom: {
    install: [0.8, 1.2], pause1: [0.4, 1.0], shift: [0.45, 0.6], raise: [0.7, 0.95],
    series: [2, 2], gestures: [2, 4], gestureDur: [0.35, 0.65], gestureAmp: [0.6, 1.15], gestureHold: [0.04, 0.2],
    passes: [1, 1], passLeg: [0.34, 0.5], passHold: [0.2, 0.32], between: [0.5, 1.2],
    away: [0.4, 0.55], down: [0.5, 0.7], recenter: [0.45, 0.7], observe: [0.6, 1.0], back: [0.8, 1.0],
  },
};

export class PostureController {
  /** Pose courante (à plat) et poids de la couche : 0 = animation de repos seule. */
  readonly pose = newPoseArray();
  weight = 0;
  /** Dernière posture stable atteinte. */
  posture: Posture = 'stand';
  goal: Posture = 'stand';
  state: PostureState = 'StandingIdle';
  seq: ActiveSeq | null = null;
  /** Identifiant de la séquence en cours (change à chaque démarrage) et compteur de séquences terminées. */
  seqId = 0;
  completed = 0;
  time = 0;
  /** Part de « contact patte-museau » demandée par la séquence (toilette), 0..1. */
  contact = 0;
  /** Point de la tête (cm, repère de la tête, côté droit) que la patte vise pendant la toilette, et côté de la patte utilisée. */
  readonly facePoint = new Float64Array(FOX_RIG.facePointsCm.muzzle);
  groomSide: 'L' | 'R' = 'R';
  /** Le regard autonome peut agir (pas pendant le sommeil, la toilette ni les transitions). */
  allowGaze = true;
  /** Dernière séquence terminée : nom et temps. */
  lastDone: { name: PostureState; at: number } | null = null;
  log: { t: number; msg: string }[] = [];

  private nudgeT = -1;
  private nextTwitchAt = 0;
  private twitchT = -1;
  private pending: 'stretch' | 'groom' | null = null;
  private pendingSide: 'L' | 'R' = 'R';
  private groomAbort = false;

  constructor(private rng: Rng, private cfg: PostureCfg = DEFAULT_POSTURE) {
    this.nextTwitchAt = this.range(cfg.sleepTwitch);
    this.pose.set(POSE_ARR.stand);
  }

  private range([a, b]: [number, number]) { return a + this.rng() * (b - a); }
  private note(msg: string) { this.log.push({ t: this.time, msg }); if (this.log.length > 200) this.log.shift(); }

  get busy() { return this.seq !== null; }
  /** Immobile dans une posture stable, sans séquence en cours ni but différent. */
  get settled() { return this.seq === null && this.goal === this.posture && this.pending === null; }
  get progress() { return this.seq ? this.seq.time / this.seq.duration : 0; }
  get remaining() { return this.seq ? Math.max(0, this.seq.duration - this.seq.time) : 0; }
  get anchors() { return this.seq?.def.anchors ?? []; }

  // ---------------------------------------------------------------- ordres
  /** But de posture. Un ordre répété ne redémarre rien. Pendant une séquence, le but est pris en compte à sa fin. */
  request(goal: Posture) {
    if (this.pending && goal !== this.posture) this.pending = null;
    this.goal = goal;
  }

  /** Étirement : seulement debout et immobile. */
  stretch(): boolean {
    if (this.seq || this.posture !== 'stand' || this.goal !== 'stand') return false;
    this.pending = 'stretch';
    return true;
  }

  /** Toilette : seulement assis et immobile. */
  groom(side: 'L' | 'R' = 'R'): boolean {
    if (this.seq || this.posture !== 'sit' || this.goal !== 'sit') return false;
    this.pending = 'groom'; this.pendingSide = side;
    return true;
  }

  /** Demande de fin de toilette : le geste en cours s'achève, la patte est reposée, puis la séquence se termine. */
  abortGroom() {
    if (this.seq?.def.name !== 'Grooming' || this.groomAbort) return;
    this.groomAbort = true;
    const s = this.seq;
    const next = s.safe.find((i) => s.t[i] >= s.time) ?? s.t.length - 1;
    s.abortAtKey = next;
    // après le point sûr (fin du geste, patte au museau), la patte est reposée selon la séquence normale de repose, puis retour à l'assise
    const side = this.groomSide, flip = (p: Pose) => (side === 'L' ? mirrorPose(p) : p);
    const from = s.arr[next], t0 = s.t[next], last = s.pt[next];
    s.arr.length = next + 1; s.t.length = next + 1; s.w.length = next + 1; s.contact.length = next + 1; s.pt.length = next + 1;
    const add = (p: Pose | Float64Array, t: number, c = 0, pt: Float64Array = last) => { s.arr.push(p instanceof Float64Array ? p : compilePose(p)); s.t.push(t); s.w.push(1); s.contact.push(c); s.pt.push(pt); };
    this.appendLower(t0, from, flip(POSES.groomShift), flip(POSES.groomSit), POSES.sit, add);
    s.duration = s.t[s.t.length - 1];
    this.note('toilette interrompue : fin du geste, patte reposée');
  }

  /** Petite réaction pendant le sommeil (caresse) : la tête bouge à peine, la posture est conservée. */
  nudge() { if (this.posture === 'sleep' && !this.seq) this.nudgeT = 0; }

  // ---------------------------------------------------------------- séquences
  private path(from: Posture, to: Posture): Posture[] {
    const prev = new Map<Posture, Posture | null>([[from, null]]);
    const q: Posture[] = [from];
    while (q.length) {
      const c = q.shift()!;
      if (c === to) break;
      for (const e of EDGES) if (e.from === c && !prev.has(e.to)) { prev.set(e.to, c); q.push(e.to); }
    }
    if (!prev.has(to)) return [];
    const out: Posture[] = []; let c: Posture | null | undefined = to;
    while (c && c !== from) { out.unshift(c); c = prev.get(c); }
    return out;
  }

  private start(def: Pick<SequenceDef, 'name' | 'from' | 'to' | 'anchors'>, arr: Float64Array[], keys: { t: number; w: number; contact?: number; pt?: Float64Array }[], safe: number[] = []) {
    this.seqId++;
    this.seq = { id: this.seqId, def, arr, t: keys.map((k) => k.t), w: keys.map((k) => k.w), contact: keys.map((k) => k.contact ?? 0), pt: keys.map((k) => k.pt ?? MUZZLE), duration: keys[keys.length - 1].t, time: 0, safe, abortAtKey: -1 };
    this.state = def.name;
    this.groomAbort = false;
    this.note(`${def.name} (${def.from}→${def.to})`);
  }

  private startStep(next: Posture) {
    const def = SEQUENCES.find((d) => d.from === this.posture && d.to === next && d.name !== 'Stretching');
    if (!def) { this.goal = this.posture; return; }
    this.start(def, compile(def), def.keys);
  }

  /** Toilette : assise stable → pause → transfert de poids → patte levée (épaule, coude, carpe) → 2 séries de petits gestes irréguliers près du museau
   *  (tête et patte, approximation : ni langue ni mâchoire) séparées de passages courbes museau → joue → base de l'oreille → pause → patte reposée au sol
   *  → thorax recentré → courte observation → retour à l'assise de référence. Chaque durée, nombre et amplitude est tiré UNE fois à l'entrée de sa phase.
   *  Chaque clé porte le point de la tête visé par la patte ; la correction de contact (animation.ts) l'y maintient à ~1,5 cm. */
  private startGroom() {
    const g = this.cfg.groom, side = this.pendingSide, flip = (p: Pose) => (side === 'L' ? mirrorPose(p) : p);
    const sit = POSES.sit, gsit = flip(POSES.groomSit), shift = flip(POSES.groomShift), up = flip(POSES.groomUp), cheek = flip(POSES.groomCheek), ear = flip(POSES.groomEar);
    this.groomSide = side;
    const arr: Float64Array[] = [POSE_ARR.sit], keys: { t: number; w: number; contact?: number; pt?: Float64Array }[] = [{ t: 0, w: 1 }], safe: number[] = [];
    const R = (r: [number, number]) => this.range(r);
    const add = (p: Pose | Float64Array, t: number, contact = 0, pt: Float64Array = MUZZLE) => { arr.push(p instanceof Float64Array ? p : compilePose(p)); keys.push({ t, w: 1, contact, pt }); };
    const mid = (a: Float64Array, b: Float64Array) => { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] + b[i]) / 2; return o; };
    const mix = (a: Pose, b: Pose, f: number | { rear: number; front: number; head: number }) => blend(a, b, f);
    const ptMid = (a: Float64Array, b: Float64Array) => mid(a, b);
    let t = 0;
    t += R(g.install); add(gsit, t);                                              // installation : bassin et cuisses se fléchissent, le thorax s'abaisse
    t += R(g.pause1); add(gsit, t);                                               // courte pause, assis stable
    t += R(g.shift); add(shift, t);                                               // transfert de poids vers le côté porteur
    const rr = R(g.raise);
    t += rr * 0.5; add(mix(shift, up, { rear: 0, front: 0.45, head: 0.15 }), t, 0.1);   // épaule et coude se plient d'abord…
    t += rr * 0.5; add(up, t, 1);                                                // …la patte arrive au museau, la tête descend à peine
    safe.push(arr.length - 1);
    const series = Math.round(R(g.series));
    for (let s = 0; s < series; s++) {
      const n = Math.round(R(g.gestures));
      for (let k = 0; k < n; k++) {                                               // petits gestes : durée, amplitude et décalage de la tête tirés au début de chaque geste
        const d = R(g.gestureDur), amp = R(g.gestureAmp), jit = (this.rng() * 2 - 1) * 3;
        t += d * 0.42; add(lickPose(up, amp, jit, side), t, 1);
        t += d * 0.58; add(up, t, 1);
        t += R(g.gestureHold); add(up, t, 1);
        safe.push(arr.length - 1);
      }
      const passes = s === 0 ? Math.round(R(g.passes)) : (this.rng() < 0.5 ? 1 : 0);   // 2e série : un passage une fois sur deux
      for (let k = 0; k < passes; k++) {                                          // passage courbe : museau → joue → base de l'oreille → joue → museau
        t += R(g.passLeg); add(mix(up, cheek, { rear: 0, front: 0.5, head: 0.4 }), t, 1, ptMid(MUZZLE, CHEEK));
        t += R(g.passLeg) * 0.6; add(cheek, t, 1, CHEEK);
        t += R(g.passLeg); add(mix(cheek, ear, { rear: 0, front: 0.5, head: 0.5 }), t, 1, ptMid(CHEEK, EAR));
        t += R(g.passLeg) * 0.7; add(ear, t, 1, EAR);
        t += R(g.passHold); add(lickPose(ear, 0.4, 0, side), t, 1, EAR);                  // frotte derrière l'oreille
        t += R(g.passLeg); add(cheek, t, 1, CHEEK);
        t += R(g.passLeg) * 0.8; add(up, t, 1);
        safe.push(arr.length - 1);
      }
      if (s < series - 1) { t += R(g.between); add(up, t, 0.9); safe.push(arr.length - 1); }  // pause, la patte reste près du museau
    }
    this.appendLower(t, up, shift, gsit, sit, add);
    this.start({ name: 'Grooming', from: 'sit', to: 'sit', anchors: [side === 'R' ? 'handL' : 'handR', 'footL2', 'footR2'] }, arr, keys, safe);
  }

  /** Repose de la patte : elle s'éloigne du visage, descend vers le sol (contact confirmé), le thorax se recentre, courte observation, retour à l'assise de référence. */
  private appendLower(t0: number, up: Pose | Float64Array, shift: Pose, gsit: Pose, sit: Pose, add: (p: Pose | Float64Array, t: number, c?: number, pt?: Float64Array) => void) {
    const g = this.cfg.groom; let t = t0;
    add(up instanceof Float64Array ? blend2(up, compilePose(shift), 0.5) : blend(up, shift, { rear: 0, front: 0.5, head: 0.4 }), t += this.range(g.away), 0.3);   // la patte s'éloigne du visage
    add(shift, t += this.range(g.down), 0);                                                                                                                   // posée au sol
    add(shift, t += 0.25, 0);                                                                                                                                 // contact confirmé avant de recentrer
    add(gsit, t += this.range(g.recenter), 0);                                                                                                                // thorax recentré
    add(gsit, t += this.range(g.observe), 0);                                                                                                                 // courte observation, assis
    add(sit, t += this.range(g.back), 0);                                                                                                                     // retour à l'assise de référence
  }

  private startStretch() {
    const def = SEQUENCES.find((d) => d.name === 'Stretching')!;
    this.start(def, compile(def), def.keys);
  }

  // ---------------------------------------------------------------- mise à jour
  update(dt: number) {
    const d = Math.min(Math.max(dt, 0), 0.1);
    this.time += d;
    if (this.seq) this.advance(d);
    if (!this.seq) {
      if (this.pending) {
        const p = this.pending; this.pending = null;
        if (p === 'stretch') this.startStretch(); else this.startGroom();
      } else if (this.goal !== this.posture) {
        const path = this.path(this.posture, this.goal);
        if (path.length) this.startStep(path[0]); else this.goal = this.posture;
      }
    }
    if (this.seq) this.sample(); else this.holdPose(d);
    this.allowGaze = !this.seq ? (this.posture === 'stand' || this.posture === 'sit' || this.posture === 'lie') : false;
  }

  private advance(d: number) {
    const s = this.seq!;
    s.time += d;
    if (s.time < s.duration) return;
    this.posture = s.def.to;
    this.state = IDLE_STATE[this.posture];
    this.completed++;
    this.lastDone = { name: s.def.name, at: this.time };
    this.seq = null;
    this.contact = 0;
    this.groomAbort = false;
    this.note(`terminé : ${s.def.name}`);
  }

  private sample() {
    const s = this.seq!;
    let i = 0;
    while (i < s.t.length - 2 && s.time >= s.t[i + 1]) i++;
    const span = s.t[i + 1] - s.t[i] || 1;
    const u = smooth((s.time - s.t[i]) / span);
    const a = s.arr[i], b = s.arr[i + 1];
    for (let j = 0; j < POSE_SIZE; j++) this.pose[j] = a[j] + (b[j] - a[j]) * u;
    this.weight = s.w[i] + (s.w[i + 1] - s.w[i]) * u;
    this.contact = s.contact[i] + (s.contact[i + 1] - s.contact[i]) * u;
    const pa = s.pt[i], pb = s.pt[i + 1];
    for (let j = 0; j < 3; j++) this.facePoint[j] = pa[j] + (pb[j] - pa[j]) * u;
    // la respiration continue pendant les séquences calmes
    this.addBreath(1);
  }

  private holdPose(d: number) {
    const base = POSE_ARR[this.posture];
    this.pose.set(base);
    this.weight = this.posture === 'stand' ? 0 : 1;
    this.contact = 0;
    this.addBreath(1);
    if (this.posture === 'sleep') {
      // frémissements rares (tirés une fois, pas à chaque image) et caresse
      if (this.twitchT < 0 && this.time >= this.nextTwitchAt) { this.twitchT = 0; this.nextTwitchAt = this.time + this.range(this.cfg.sleepTwitch); }
      if (this.twitchT >= 0) {
        this.twitchT += d;
        const k = Math.sin(Math.min(1, this.twitchT / 0.9) * Math.PI);
        this.pose[idx('tail2', 2)] += 9 * k; this.pose[idx('tail3', 2)] += 12 * k;
        if (this.twitchT > 0.9) this.twitchT = -1;
      }
      if (this.nudgeT >= 0) {
        this.nudgeT += d;
        const k = Math.sin(Math.min(1, this.nudgeT / 1.4) * Math.PI);
        this.pose[idx('neck', 0)] -= 7 * k; this.pose[idx('head', 0)] -= 6 * k; this.pose[idx('tail1', 2)] += 6 * k;
        if (this.nudgeT > 1.4) this.nudgeT = -1;
      }
    }
  }

  /** Respiration discrète : tangage de la colonne uniquement (jamais d'échelle du corps). */
  private addBreath(k: number) {
    const b = this.cfg.breath[this.seq ? this.seq.def.to === 'stand' ? 'sit' : this.seq.def.to : this.posture];
    if (!b || this.weight < 0.5) return;
    const s = Math.sin(this.time * Math.PI * 2 * b.hz) * b.amp * k;
    this.pose[idx('spine1', 0)] += s * 0.6; this.pose[idx('spine2', 0)] += s;
    this.pose[idx('neck', 0)] -= s * 0.4;
  }
}

function blend2(a: Float64Array, b: Float64Array, t: number): Float64Array { const o = newPoseArray(); for (let i = 0; i < POSE_SIZE; i++) o[i] = a[i] + (b[i] - a[i]) * t; return o; }

/** Petit geste de nettoyage : la patte pivote un peu (carpe) et la tête s'incline légèrement vers elle, avec un petit décalage de lacet tiré par geste.
 *  Approximation : le modèle n'a ni langue ni mâchoire. L'amplitude reste faible pour que la patte fasse l'essentiel du mouvement. */
function lickPose(up: Pose, amp: number, jit = 0, side: 'L' | 'R' = 'R'): Pose {
  const r = { ...up.r };
  const h = up.r.head ?? [0, 0, 0], n = up.r.neck ?? [0, 0, 0], hk = (side === 'R' ? 'handR' : 'handL') as BoneKey, fk = (side === 'R' ? 'foreR' : 'foreL') as BoneKey;
  const hand = up.r[hk] ?? [0, 0, 0], fore = up.r[fk] ?? [0, 0, 0];
  r.head = [h[0] + 3.5 * amp, h[1], h[2] + jit]; r.neck = [n[0] + 1.5 * amp, n[1], n[2]];
  r[hk] = [hand[0] + 12 * amp, hand[1], hand[2]]; r[fk] = [fore[0] - 5 * amp, fore[1], fore[2]];
  return { r, hip: up.hip };
}
