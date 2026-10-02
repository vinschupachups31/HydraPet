/** Correction des appuis : pendant l'appui d'une patte, le pied garde son contact au sol en coordonnées monde.
 *  - phases d'appui = métadonnées du clip (tools/extract-contacts.mjs) ;
 *  - le contact est pris à la pose (début d'appui) et relâché progressivement avant la levée ;
 *  - la chaîne articulée est résolue vers ce point par CCD, avec correction plafonnée (distance et angle par articulation) ;
 *  - au-delà de la portée, le contact est relâché proprement (pas d'extrapolation) ;
 *  - jamais les quatre pattes verrouillées en permanence : l'enveloppe suit les phases d'appui du clip.
 *  À appeler APRÈS `mixer.update` et après la mise à jour des matrices : le mixeur réécrit les os à chaque image,
 *  donc rien ne s'accumule d'une image à l'autre. */
import * as THREE from 'three';
import { FootIKConfig } from '../config/animation';
import { FootContacts } from '../config/foxClips';

/** `contact` : point d'appui sous la patte, dans le repère de l'os du bout (unités du modèle) ; absent : l'origine de l'os. */
export interface FootChainDef { foot: string; bones: string[]; contact?: [number, number, number] }

export interface FootDebug { name: string; inContact: boolean; weight: number; error: number; released: boolean; correction: number }

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Position dans l'intervalle d'appui [a, b] (phase circulaire) : null si la phase est hors appui, sinon u dans [0, 1]. */
export function contactPosition(contacts: [number, number][], phase: number): number | null {
  for (const [a, b] of contacts) {
    const len = b >= a ? b - a : 1 - a + b;
    const d = phase >= a ? phase - a : phase + 1 - a;
    if (d >= 0 && d <= len && len > 1e-6) return d / len;
  }
  return null;
}

/** Enveloppe du verrouillage : montée en début d'appui, relâchement progressif avant la levée. */
export function contactEnvelope(u: number, rise: number, fall: number): number {
  return smooth(0, Math.max(1e-3, rise), u) * (1 - smooth(1 - Math.max(1e-3, fall), 1, u));
}


export interface SolveParams { iterations: number; stepLimit: number; maxJointDelta: number }
const _sp = new THREE.Vector3(), _se = new THREE.Vector3(), _sa = new THREE.Vector3(), _st = new THREE.Vector3();
const _spq = new THREE.Quaternion(), _swr = new THREE.Quaternion(), _sl = new THREE.Quaternion();

/** CCD plafonné sur une chaîne d'os (de la racine à l'effecteur) vers une cible monde. `offset` : point de l'effecteur (repère local de l'os) à amener sur la cible.
 *  Chaque articulation tourne peu par itération et jamais de plus de `maxJointDelta` par rapport à la pose de départ : la flexion naturelle est préservée.
 *  Retourne l'écart final (m) entre le point suivi et la cible. */
export function solveChain(chain: THREE.Object3D[], effector: THREE.Object3D, offset: THREE.Vector3 | null, target: THREE.Vector3, p: SolveParams): number {
  const n = chain.length - (chain[chain.length - 1] === effector ? 1 : 0); // articulations tournées : toutes sauf l'effecteur lui-même
  const original = chain.slice(0, n).map((b) => b.quaternion.clone());
  const tip = (out: THREE.Vector3) => (offset ? out.copy(offset).applyMatrix4(effector.matrixWorld) : effector.getWorldPosition(out));
  for (let it = 0; it < p.iterations; it++) {
    for (let i = n - 1; i >= 0; i--) {
      const bone = chain[i];
      bone.getWorldPosition(_sp);
      tip(_se);
      _sa.copy(_se).sub(_sp); _st.copy(target).sub(_sp);
      if (_sa.lengthSq() < 1e-10 || _st.lengthSq() < 1e-10) continue;
      _sa.normalize(); _st.normalize();
      const axis = _sp.crossVectors(_sa, _st);
      const s = axis.length();
      if (s < 1e-6) continue;
      const ang = Math.min(p.stepLimit, Math.atan2(s, _sa.dot(_st)));
      _swr.setFromAxisAngle(axis.divideScalar(s), ang);
      bone.parent!.getWorldQuaternion(_spq);
      _sl.copy(_spq).invert().multiply(_swr).multiply(_spq);
      bone.quaternion.premultiply(_sl);
      const dev = 2 * Math.acos(Math.min(1, Math.abs(original[i].dot(bone.quaternion))));
      if (dev > p.maxJointDelta) bone.quaternion.copy(original[i]).slerp(bone.quaternion, p.maxJointDelta / dev);
      bone.updateMatrixWorld(true);
    }
    tip(_se);
    if (_se.distanceTo(target) < 5e-4) break;
  }
  tip(_se);
  return _se.distanceTo(target);
}

interface FootState {
  def: FootChainDef;
  chain: THREE.Object3D[];
  effector: THREE.Object3D;
  /** Décalage du point d'appui dans le repère de l'effecteur (null : origine de l'os). */
  off: THREE.Vector3 | null;
  contacts: [number, number][];
  plant: THREE.Vector3 | null;
  wasIn: boolean;
  released: boolean;
  /** Pas de rattrapage en cours (0 → 1) : le pied quitte son point d'appui en se soulevant au lieu de glisser ou de claquer. */
  step: number;
  stepFrom: THREE.Vector3 | null;
  weight: number;
  error: number;
  correction: number;
  /** Hauteur la plus basse observée de ce pied (m) : référence du sol pour savoir s'il est posé. */
  minY: number;
  /** Plante tenue à l'arrêt (hors phases de clip). */
  held: boolean;
}

const _p = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3(), _axis = new THREE.Vector3();
const _pq = new THREE.Quaternion(), _wr = new THREE.Quaternion(), _l = new THREE.Quaternion();

export class FootIK {
  readonly feet: FootState[] = [];
  /** Os sans piste d'animation : ils ne seraient pas réécrits par le mixeur et la correction s'y accumulerait. */
  readonly missing: string[] = [];

  constructor(root: THREE.Object3D, defs: FootChainDef[], contactsByFoot: Record<string, [number, number][]>, private cfg: FootIKConfig) {
    for (const def of defs) {
      const chain = def.bones.map((n) => root.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
      if (chain.length !== def.bones.length) { this.missing.push(def.foot); continue; }
      this.feet.push({ def, chain, effector: chain[chain.length - 1], off: def.contact ? new THREE.Vector3(...def.contact) : null, contacts: contactsByFoot[def.foot] ?? [], plant: null, wasIn: false, released: false, step: 0, stepFrom: null, weight: 0, error: 0, correction: 0, minY: Infinity, held: false });
    }
  }

  setConfig(cfg: FootIKConfig) { this.cfg = cfg; }

  /** Point d'appui du pied en monde (dessous de la patte si le profil le définit). */
  contactPoint(f: FootState, out: THREE.Vector3) { return f.off ? out.copy(f.off).applyMatrix4(f.effector.matrixWorld) : f.effector.getWorldPosition(out); }

  private release(f: FootState) { f.plant = null; f.step = 0; f.stepFrom = null; f.weight = 0; f.error = 0; f.correction = 0; }

  /** Corps arrêté, debout : chaque pied posé garde son point de contact en coordonnées monde (aucun glissement lors du passage marche → repos
   *  ni pendant le repos). Les pieds encore en l'air sont plantés dès qu'ils touchent le sol. Tout est relâché dès que la marche reprend. */
  hold(dt = 1 / 60) {
    const c = this.cfg;
    if (!c.enabled || !c.holdAtRest) { for (const f of this.feet) { this.release(f); f.wasIn = false; f.released = false; f.held = false; } return; }
    for (const f of this.feet) {
      this.contactPoint(f, _e);
      f.minY = Math.min(f.minY, _e.y);
      f.wasIn = false; f.released = false;
      if (!f.plant) {
        if (_e.y > f.minY + c.groundTolerance) { f.weight = 0; f.error = 0; continue; } // encore en l'air
        f.plant = _e.clone(); f.held = true;
      }
      const dx = f.plant.x - _e.x, dz = f.plant.z - _e.z, err = Math.hypot(dx, dz);
      f.error = err;
      if (err > c.holdReach) { f.plant = null; f.held = false; f.weight = 0; continue; } // hors de portée : relâché, il sera replanté où il est
      f.weight = 1;
      _t.set(f.plant.x, _e.y, f.plant.z);
      this.solve(f, _t);
    }
    void dt;
  }

  /** @param active  vrai quand un clip de locomotion corrigeable domine et que le corps avance (sinon tout est relâché) */
  update(active: boolean, phase: number, dt = 1 / 60) {
    const c = this.cfg;
    if (!c.enabled || !active) { for (const f of this.feet) { this.release(f); f.wasIn = false; f.released = false; } return; }
    for (const f of this.feet) {
      const u = contactPosition(f.contacts, phase);
      if (u === null) { this.release(f); f.wasIn = false; f.released = false; continue; }
      this.contactPoint(f, _e);
      f.minY = Math.min(f.minY, _e.y); const wasHeld = f.held; f.held = false;
      if (!f.wasIn) { if (!(f.plant && wasHeld)) f.plant = _e.clone(); f.released = false; f.wasIn = true; } // pose du pied : le contact est pris ici, en coordonnées monde
      if (!f.stepFrom && f.plant && c.stepDuration > 0 && Math.hypot(f.plant.x - _e.x, f.plant.z - _e.z) > c.maxCorrection) {
        f.stepFrom = f.plant.clone(); f.step = -dt / c.stepDuration; f.plant = null; // hors de portée : le pied part en pas depuis son point d'appui (continuité : il y était tenu à l'image précédente)
      }
      if (f.stepFrom) { // pas de rattrapage : arc du point d'appui vers la pose animée, avec une petite levée
        f.step = Math.min(1, f.step + dt / c.stepDuration);
        const e = f.step * f.step * (3 - 2 * f.step);
        _t.set(f.stepFrom.x + (_e.x - f.stepFrom.x) * e, _e.y + c.stepLift * Math.sin(Math.PI * f.step), f.stepFrom.z + (_e.z - f.stepFrom.z) * e);
        f.weight = 1; f.error = 0;
        this.solve(f, _t);
        if (f.step >= 1) { f.stepFrom = null; f.plant = _e.clone(); f.released = false; f.weight = 0; } // le pas est posé : le pied est planté à son nouvel endroit (il tiendra, ou refera un pas)
        continue;
      }
      if (f.released || !f.plant) { f.weight = 0; f.error = 0; continue; }
      const env = contactEnvelope(u, c.rise, c.fall);
      const dx = f.plant.x - _e.x, dz = f.plant.z - _e.z;
      const err = Math.hypot(dx, dz);
      f.error = err;
      if (err > c.maxCorrection) { // hors de portée : pas d'extrapolation. Le pied se déplace par un vrai petit pas (levée) vers la pose animée
        f.released = true; f.plant = null; f.weight = 0; f.correction = 0; continue;
      }
      f.weight = env;
      if (env < 1e-3) { f.correction = 0; continue; }
      // glissement horizontal corrigé ; la hauteur rejoint le sol (dessous de la patte à y = 0) selon `groundLock`, plafonnée à `maxLower` : jamais de pied suspendu pendant un appui
      const gy = c.groundLock > 0 ? _e.y - Math.max(-c.maxLower, Math.min(c.maxLower, _e.y - c.groundY)) * env * c.groundLock : _e.y;
      _t.set(_e.x + dx * env, gy, _e.z + dz * env);
      this.solve(f, _t);
    }
  }

  /** CCD plafonné : chaque articulation tourne peu, et jamais de plus de `maxJointDelta` par rapport à la pose animée. */
  private solve(f: FootState, target: THREE.Vector3) {
    f.correction = solveChain(f.chain, f.effector, f.off, target, this.cfg);
  }

  debug(): FootDebug[] {
    return this.feet.map((f) => ({ name: f.def.foot, inContact: f.plant !== null || f.released || f.stepFrom !== null, weight: f.weight, error: f.error, released: f.released, correction: f.correction }));
  }
}
