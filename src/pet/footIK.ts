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

export interface FootChainDef { foot: string; bones: string[] }

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

interface FootState {
  def: FootChainDef;
  chain: THREE.Object3D[];
  effector: THREE.Object3D;
  contacts: [number, number][];
  plant: THREE.Vector3 | null;
  wasIn: boolean;
  released: boolean;
  weight: number;
  error: number;
  correction: number;
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
      this.feet.push({ def, chain, effector: chain[chain.length - 1], contacts: contactsByFoot[def.foot] ?? [], plant: null, wasIn: false, released: false, weight: 0, error: 0, correction: 0 });
    }
  }

  setConfig(cfg: FootIKConfig) { this.cfg = cfg; }

  private release(f: FootState) { f.plant = null; f.weight = 0; f.error = 0; f.correction = 0; }

  /** @param active  vrai quand un clip de locomotion corrigeable domine et que le corps avance (sinon tout est relâché) */
  update(active: boolean, phase: number) {
    const c = this.cfg;
    if (!c.enabled || !active) { for (const f of this.feet) { this.release(f); f.wasIn = false; f.released = false; } return; }
    for (const f of this.feet) {
      const u = contactPosition(f.contacts, phase);
      if (u === null) { this.release(f); f.wasIn = false; f.released = false; continue; }
      f.effector.getWorldPosition(_e);
      if (!f.wasIn) { f.plant = _e.clone(); f.released = false; f.wasIn = true; } // pose du pied : le contact est pris ici, en coordonnées monde
      if (f.released || !f.plant) { f.weight = 0; f.error = 0; continue; }
      const env = contactEnvelope(u, c.rise, c.fall);
      const dx = f.plant.x - _e.x, dz = f.plant.z - _e.z;
      const err = Math.hypot(dx, dz);
      f.error = err;
      if (err > c.maxCorrection) { f.released = true; f.plant = null; f.weight = 0; f.correction = 0; continue; } // hors de portée : relâché, pas d'extrapolation
      f.weight = env;
      if (env < 1e-3) { f.correction = 0; continue; }
      _t.set(_e.x + dx * env, _e.y, _e.z + dz * env); // la hauteur reste celle de l'animation : seul le glissement horizontal est corrigé
      this.solve(f, _t);
    }
  }

  /** CCD plafonné : chaque articulation tourne peu, et jamais de plus de `maxJointDelta` par rapport à la pose animée. */
  private solve(f: FootState, target: THREE.Vector3) {
    const c = this.cfg;
    const n = f.chain.length - 1; // articulations tournées : toutes sauf l'effecteur
    const original = f.chain.slice(0, n).map((b) => b.quaternion.clone());
    for (let it = 0; it < c.iterations; it++) {
      for (let i = n - 1; i >= 0; i--) {
        const bone = f.chain[i];
        bone.getWorldPosition(_p);
        f.effector.getWorldPosition(_e);
        const toE = _e.clone().sub(_p), toT = target.clone().sub(_p);
        if (toE.lengthSq() < 1e-10 || toT.lengthSq() < 1e-10) continue;
        toE.normalize(); toT.normalize();
        _axis.crossVectors(toE, toT);
        const s = _axis.length();
        if (s < 1e-6) continue;
        const ang = Math.min(c.stepLimit, Math.atan2(s, toE.dot(toT)));
        _wr.setFromAxisAngle(_axis.divideScalar(s), ang);
        // rotation monde → repère du parent
        bone.parent!.getWorldQuaternion(_pq);
        _l.copy(_pq).invert().multiply(_wr).multiply(_pq);
        bone.quaternion.premultiply(_l);
        // préserve la flexion naturelle : écart total plafonné par rapport à la pose animée
        const dev = 2 * Math.acos(Math.min(1, Math.abs(original[i].dot(bone.quaternion))));
        if (dev > c.maxJointDelta) bone.quaternion.copy(original[i]).slerp(bone.quaternion, c.maxJointDelta / dev);
        bone.updateMatrixWorld(true);
      }
      f.effector.getWorldPosition(_e);
      if (_e.distanceTo(target) < 5e-4) break;
    }
    // correction réellement obtenue (m) : écart entre la position animée visée et la position finale
    f.effector.getWorldPosition(_e);
    f.correction = _e.distanceTo(target);
  }

  debug(): FootDebug[] {
    return this.feet.map((f) => ({ name: f.def.foot, inContact: f.plant !== null || f.released, weight: f.weight, error: f.error, released: f.released, correction: f.correction }));
  }
}
