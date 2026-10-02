/** PoseRig : pose procédurale du squelette, par rotations d'articulations (jamais par rotation ou échelle du modèle entier).
 *  Une pose = rotation de chaque os RELATIVE À SON PARENT, exprimée dans les axes du modèle (tangage autour de l'axe latéral, roulis
 *  autour de l'axe avant, lacet autour de la verticale) à partir de la pose de liage. Les angles s'additionnent donc le long d'une chaîne.
 *  À appeler APRÈS `mixer.update` : le mixeur réécrit les os à chaque image, rien ne s'accumule. */
import * as THREE from 'three';
import { BoneKey, FOX_RIG } from '../config/foxRig';
import { FOX_HULL } from '../config/foxHull';

export type Euler3 = [number, number, number]; // tangage, roulis, lacet (degrés). Tangage > 0 : ce qui pointe vers l'avant descend.
export interface Pose {
  r: Partial<Record<BoneKey, Euler3>>;
  /** Décalage du bassin (cm, repère du modèle : x gauche, y haut, z avant). */
  hip?: [number, number, number];
}

const D2R = Math.PI / 180;
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Euler();

const BONE_ORDER = Object.keys(FOX_RIG.bones) as BoneKey[];
/** Une pose « à plat » : 3 angles par os dans l'ordre du squelette, puis 3 valeurs pour le bassin (cm). Aucune allocation à l'exécution. */
export const POSE_SIZE = BONE_ORDER.length * 3 + 3;
export const newPoseArray = () => new Float64Array(POSE_SIZE);
export function compilePose(p: Pose, out: Float64Array = newPoseArray()): Float64Array {
  out.fill(0);
  BONE_ORDER.forEach((k, i) => { const e = p.r[k]; if (e) { out[i * 3] = e[0]; out[i * 3 + 1] = e[1]; out[i * 3 + 2] = e[2]; } });
  if (p.hip) { const o = BONE_ORDER.length * 3; out[o] = p.hip[0]; out[o + 1] = p.hip[1]; out[o + 2] = p.hip[2]; }
  return out;
}
const _eu: Euler3 = [0, 0, 0];

export class PoseRig {
  readonly bones = {} as Record<BoneKey, THREE.Object3D>;
  readonly keys = Object.keys(FOX_RIG.bones) as BoneKey[];
  readonly missing: string[] = [];
  private restQ = {} as Record<BoneKey, THREE.Quaternion>;
  private parentBindQ = {} as Record<BoneKey, THREE.Quaternion>;
  private hipRest = new THREE.Vector3();
  private hullPts: { bone: THREE.Object3D; p: THREE.Vector3 }[] = [];
  /** Unités du modèle par centimètre (échelle de référence). */
  readonly cm: number;
  /** Mètres par unité du modèle (échelle réelle de l'objet racine). */
  readonly unit: number;
  /** Décalage vertical appliqué par le sol (m) : debug. */
  groundShift = 0;

  constructor(private root: THREE.Object3D) {
    this.unit = root.scale.x || 1;
    this.cm = FOX_RIG.refScale * 100 > 0 ? 1 / (FOX_RIG.refScale * 100) : 1; // 1 cm = 1/(0,46) unités
    // Pose de liage lue dans les matrices inverses de la peau : indépendante de l'état d'animation du modèle au moment de la construction.
    let skin: THREE.SkinnedMesh | null = null;
    root.traverse((o) => { if (!skin && (o as THREE.SkinnedMesh).isSkinnedMesh) skin = o as THREE.SkinnedMesh; });
    const bindWorld = new Map<THREE.Object3D, THREE.Matrix4>();
    if (skin) { const sk = (skin as THREE.SkinnedMesh).skeleton; sk.bones.forEach((b, i) => bindWorld.set(b, sk.boneInverses[i].clone().invert())); }
    const m = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), pq = new THREE.Quaternion();
    for (const k of this.keys) {
      const b = root.getObjectByName(FOX_RIG.bones[k]);
      if (!b || !bindWorld.has(b) || !b.parent || !bindWorld.has(b.parent)) { this.missing.push(FOX_RIG.bones[k]); continue; }
      this.bones[k] = b;
      const pw = bindWorld.get(b.parent)!;
      m.copy(pw).invert().multiply(bindWorld.get(b)!).decompose(pos, q, sc);
      this.restQ[k] = q.clone();
      pw.decompose(pos, pq, sc);
      this.parentBindQ[k] = pq.clone();
      if (k === 'hip') { m.copy(pw).invert().multiply(bindWorld.get(b)!).decompose(pos, q, sc); this.hipRest.copy(pos); }
    }
    for (const [name, pts] of Object.entries(FOX_HULL)) {
      const bone = root.getObjectByName(name);
      if (bone) for (const p of pts) this.hullPts.push({ bone, p: new THREE.Vector3(p[0], p[1], p[2]) });
    }
  }

  /** Rotation d'une pose (axes du modèle) → quaternion local de l'os, par rapport à sa pose de liage. */
  private target(k: BoneKey, e: Euler3, out: THREE.Quaternion) {
    _e.set(e[0] * D2R, e[2] * D2R, e[1] * D2R, 'YXZ'); // lacet (Y) · tangage (X) · roulis (Z)
    _q.setFromEuler(_e);
    _qa.copy(this.parentBindQ[k]);
    out.copy(_qa).invert().multiply(_q).multiply(_qa).multiply(this.restQ[k]); // P⁻¹ · R · P · rest
  }

  /** Applique une pose avec un poids global (0 = animation seule, 1 = pose seule) et des poids par os facultatifs. */
  apply(pose: Pose, weight: number, boneWeight?: Partial<Record<BoneKey, number>>) { this.applyArray(compilePose(pose), weight, boneWeight); }

  applyArray(a: ArrayLike<number>, weight: number, boneWeight?: Partial<Record<BoneKey, number>>) {
    if (weight <= 1e-4) return;
    for (let i = 0; i < BONE_ORDER.length; i++) {
      const k = BONE_ORDER[i], b = this.bones[k]; if (!b) continue;
      const w = Math.min(1, weight * (boneWeight?.[k] ?? 1));
      _eu[0] = a[i * 3]; _eu[1] = a[i * 3 + 1]; _eu[2] = a[i * 3 + 2];
      this.target(k, _eu, _qb);
      b.quaternion.slerp(_qb, w);
    }
    const hip = this.bones.hip;
    if (hip) {
      const o = BONE_ORDER.length * 3;
      _v.set(a[o] * this.cm, a[o + 1] * this.cm, a[o + 2] * this.cm);
      _w.copy(_v).applyQuaternion(_qa.copy(this.parentBindQ.hip).invert());
      _w.add(this.hipRest);
      hip.position.lerp(_w, Math.min(1, weight));
    }
  }

  /** Sommets extrêmes du maillage (monde) : pour l'extraction d'enveloppes par pose et les tests de contact. */
  hullWorld(out: THREE.Vector3[]) {
    this.root.updateMatrixWorld(true);
    out.length = 0;
    for (const { bone, p } of this.hullPts) out.push(p.clone().applyMatrix4(bone.matrixWorld));
    return out;
  }

  /** Point le plus bas du maillage (m, monde). Sommets extrêmes par os : suffisant pour tenir le corps au-dessus du sol. */
  lowestY(): number {
    this.root.updateMatrixWorld(true);
    let m = Infinity;
    for (const { bone, p } of this.hullPts) { _v.copy(p).applyMatrix4(bone.matrixWorld); if (_v.y < m) m = _v.y; }
    return m;
  }

  /** Garde le corps posé : déplace le bassin (articulation, pas le modèle) verticalement pour que le point le plus bas touche le sol.
   *  `weight` pondère la correction (0 = rien). La hauteur de la pose animée n'est pas touchée quand le poids est nul. */
  groundSolve(weight: number, lift = 0) {
    if (weight <= 1e-4 || !this.bones.hip) { this.groundShift = 0; return; }
    const dy = (-this.lowestY() + lift) * weight; // m (monde)
    this.groundShift = dy;
    const hip = this.bones.hip;
    const parent = hip.parent!;
    parent.getWorldQuaternion(_qa).invert();
    const s = this.unit || 1;
    _v.set(0, dy / s, 0).applyQuaternion(_qa);
    hip.position.add(_v);
    this.root.updateMatrixWorld(true);
  }

  /** Position monde d'un point du repère d'un os (cm → unités). */
  pointOn(key: BoneKey, cm: [number, number, number], out: THREE.Vector3) {
    return out.set(cm[0] * this.cm, cm[1] * this.cm, cm[2] * this.cm).applyMatrix4(this.bones[key].matrixWorld);
  }

  /** Position monde du bout du museau (repère de la tête en pose de liage, suit la tête). */
  muzzle(out: THREE.Vector3) {
    const head = this.bones.head;
    // le décalage est donné dans les axes du modèle en pose de liage : on le ramène au repère de l'os de la tête
    _qa.copy(this.parentBindQ.head).multiply(this.restQ.head).invert();
    _v.set(FOX_RIG.muzzleCm[0] * this.cm, FOX_RIG.muzzleCm[1] * this.cm, FOX_RIG.muzzleCm[2] * this.cm).applyQuaternion(_qa);
    return out.copy(_v).applyMatrix4(head.matrixWorld);
  }

  /** Coussinet de la patte avant (haut du pied, devant le poignet), en monde. */
  pad(side: 'L' | 'R', out: THREE.Vector3) {
    const hand = FOX_RIG.forepaw[side][2];
    const b = this.bones[hand];
    _qa.copy(this.parentBindQ[hand]).multiply(this.restQ[hand]).invert();
    _v.set(FOX_RIG.padCm[0] * this.cm, FOX_RIG.padCm[1] * this.cm, FOX_RIG.padCm[2] * this.cm).applyQuaternion(_qa);
    return out.copy(_v).applyMatrix4(b.matrixWorld);
  }
}
